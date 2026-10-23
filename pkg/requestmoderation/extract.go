package requestmoderation

import (
	"crypto/sha256"
	"encoding/binary"
	"errors"
	"fmt"
	"slices"
	"strings"
	"unicode/utf8"

	"github.com/QuantumNous/new-api/common"
	"github.com/tidwall/gjson"
	"golang.org/x/text/unicode/norm"
)

func SupportedPath(path string) bool {
	return path == "/v1/chat/completions" || path == "/v1/completions" || path == "/v1/messages" || path == "/v1/responses" || strings.HasSuffix(path, ":generateContent") || strings.HasSuffix(path, ":streamGenerateContent")
}

func stableSample(requestID string, p Policy) bool {
	hash := sha256.Sum256([]byte(fmt.Sprintf("%s:%d:%d", requestID, p.ID, p.Version)))
	return float64(binary.BigEndian.Uint64(hash[:8])>>11)/float64(uint64(1)<<53)*100 < p.SamplePercent
}

// Extract never interprets images, files or arbitrary JSON strings as text.
// It preserves protocol roles; any unhandled item makes coverage incomplete.
func Extract(body []byte, limit int) (Content, error) {
	content := Content{Coverage: Coverage{Complete: true, OriginalBytes: len(body)}, Messages: []Message{}, Hits: []string{}}
	if !gjson.ValidBytes(body) {
		return content, errors.New("invalid_request_json")
	}
	root := gjson.ParseBytes(body)
	if root.Get("previous_response_id").Exists() || root.Get("conversation").Exists() {
		content.partial("unresolved_history")
	}
	if root.Get("messages").IsArray() {
		root.Get("messages").ForEach(func(_, msg gjson.Result) bool {
			content.addParts(msg.Get("role").String(), msg.Get("content"), limit)
			if msg.Get("tool_calls").Exists() || msg.Get("function_call").Exists() {
				content.partial("tool_calls_not_scanned")
			}
			return true
		})
	} else if root.Get("contents").IsArray() {
		root.Get("contents").ForEach(func(_, msg gjson.Result) bool {
			content.addParts(msg.Get("role").String(), msg.Get("parts"), limit)
			return true
		})
	} else if input := root.Get("input"); input.Exists() {
		if input.Type == gjson.String {
			content.addText("user", input.String(), limit)
		} else if input.IsArray() {
			input.ForEach(func(_, msg gjson.Result) bool {
				role := msg.Get("role").String()
				if role == "" {
					content.partial("non_message_input")
					role = "tool"
				}
				if msg.Get("content").Exists() {
					content.addParts(role, msg.Get("content"), limit)
				} else {
					content.partial("unsupported_input")
				}
				return true
			})
		} else {
			content.partial("unsupported_input")
		}
	} else if prompt := root.Get("prompt"); prompt.Exists() {
		if prompt.Type == gjson.String {
			content.addText("user", prompt.String(), limit)
		} else if prompt.IsArray() {
			prompt.ForEach(func(_, v gjson.Result) bool {
				if v.Type == gjson.String {
					content.addText("user", v.String(), limit)
				} else {
					content.partial("tokenized_prompt")
				}
				return true
			})
		} else {
			content.partial("unsupported_prompt")
		}
	} else {
		content.partial("unsupported_protocol")
	}
	for _, key := range []string{"system", "instructions"} {
		if v := root.Get(key); v.Exists() {
			content.addParts("system", v, limit)
		}
	}
	for _, key := range []string{"systemInstruction.parts", "system_instruction.parts"} {
		if v := root.Get(key); v.Exists() {
			content.addParts("system", v, limit)
		}
	}
	if tools := root.Get("tools"); tools.IsArray() {
		tools.ForEach(func(_, tool gjson.Result) bool {
			for _, key := range []string{"description", "function.description"} {
				if v := tool.Get(key); v.Type == gjson.String {
					content.addText("tool_description", v.String(), limit)
				}
			}
			content.partial("tool_schema_not_scanned")
			return true
		})
	}
	if len(content.Messages) == 0 {
		content.partial("no_text")
	}
	return content, nil
}

func (c *Content) partial(reason string) {
	c.Coverage.Complete = false
	if !slices.Contains(c.Coverage.Reasons, reason) {
		c.Coverage.Reasons = append(c.Coverage.Reasons, reason)
	}
}
func prefix(text string, n int) string {
	if n >= len(text) {
		return text
	}
	n = max(0, n)
	for n > 0 && !utf8.RuneStart(text[n]) {
		n--
	}
	return text[:n]
}
func (c *Content) addText(role, text string, limit int) {
	if text == "" {
		return
	}
	if len(c.Messages) >= 2048 {
		c.partial("message_limit")
		return
	}
	if !slices.Contains([]string{"user", "system", "developer", "assistant", "tool", "function", "model", "tool_description"}, role) {
		role = "unknown"
		c.partial("unknown_role")
	}
	remaining := limit - c.Coverage.ScannedBytes
	if len(text) > remaining {
		c.partial("scan_truncated")
		text = prefix(text, remaining)
	}
	if text == "" {
		return
	}
	c.Messages = append(c.Messages, Message{Index: len(c.Messages), Role: role, Text: strings.Clone(text)})
	c.Coverage.ScannedBytes += len(text)
}
func (c *Content) addParts(role string, v gjson.Result, limit int) {
	if v.Type == gjson.String {
		c.addText(role, v.String(), limit)
		return
	}
	if !v.IsArray() {
		if v.Type != gjson.Null {
			c.partial("unsupported_content")
		}
		return
	}
	v.ForEach(func(_, part gjson.Result) bool {
		kind := part.Get("type").String()
		if kind == "tool_result" {
			c.addParts("tool", part.Get("content"), limit)
		} else if slices.Contains([]string{"text", "input_text", "output_text", ""}, kind) && part.Get("text").Type == gjson.String {
			c.addText(role, part.Get("text").String(), limit)
		} else {
			c.partial("attachments_or_blocks_not_scanned")
		}
		return true
	})
}

func screen(p *compiledPolicy, c Content, requestID string, reviewBytes int) (Content, string) {
	priority := make([]int, 0, len(c.Messages))
	other := make([]int, 0, len(c.Messages))
	for i, msg := range c.Messages {
		hit := false
		if p.matcher != nil {
			normalized := strings.ToLower(norm.NFKC.String(msg.Text))
			matches := p.matcher.MultiPatternSearch([]rune(normalized), true)
			if len(matches) > 0 {
				hit = true
				word := string(matches[0].Word)
				if !slices.Contains(c.Hits, word) {
					c.Hits = append(c.Hits, word)
				}
			}
		}
		if hit {
			priority = append(priority, i)
		} else {
			other = append(other, i)
		}
	}
	selection := "keyword"
	if len(c.Hits) == 0 {
		if !c.Coverage.Complete {
			selection = "coverage_incomplete"
		} else if stableSample(requestID, p.Policy) {
			selection = "sample"
		} else {
			return c, "skipped_not_sampled"
		}
	}
	remaining := reviewBytes
	retained := make(map[int]string, len(c.Messages))
	for _, i := range append(priority, other...) {
		text := c.Messages[i].Text
		if len(text) > remaining {
			c.partial("review_truncated")
			// Prefer a window around a literal keyword hit. Normalization-only
			// hits retain the original prefix and are explicitly partial.
			for _, word := range c.Hits {
				if at := strings.Index(strings.ToLower(text), word); at >= 0 && at > remaining/2 {
					start := max(0, at-remaining/3)
					for start > 0 && !utf8.RuneStart(text[start]) {
						start--
					}
					text = text[start:]
					break
				}
			}
			text = prefix(text, remaining)
		}
		remaining -= len(text)
		if text != "" {
			retained[i] = text
		}
	}
	messages := make([]Message, 0, len(retained))
	for i, msg := range c.Messages {
		if text, ok := retained[i]; ok {
			msg.Text = text
			messages = append(messages, msg)
		}
	}
	c.Messages = messages
	c.Coverage.ReviewedBytes = reviewBytes - remaining
	return c, selection
}

func ValidateResult(text string, c Content) (*Result, error) {
	if len(text) > 32768 || !gjson.Valid(text) || !gjson.Parse(text).IsObject() {
		return nil, errors.New("invalid_result_json")
	}
	root := gjson.Parse(text)
	allowed := []string{"verdict", "categories", "severity", "reason", "evidence", "needs_review"}
	valid := true
	count := 0
	seen := make(map[string]bool, 6)
	root.ForEach(func(k, v gjson.Result) bool {
		count++
		if !slices.Contains(allowed, k.String()) || seen[k.String()] {
			valid = false
		}
		seen[k.String()] = true
		return true
	})
	if !valid || count != 6 || !root.Get("evidence").IsArray() || !root.Get("categories").IsArray() || (root.Get("needs_review").Type != gjson.True && root.Get("needs_review").Type != gjson.False) {
		return nil, errors.New("invalid_result_schema")
	}
	var result Result
	if err := common.UnmarshalJsonStr(text, &result); err != nil {
		return nil, errors.New("invalid_result_schema")
	}
	if !slices.Contains([]string{"safe", "suspicious", "violation", "uncertain"}, result.Verdict) || severity(result.Severity) == 0 || strings.TrimSpace(result.Reason) == "" || len(result.Reason) > 2000 || result.Categories == nil || len(result.Categories) > 4 || len(result.Evidence) > 16 {
		return nil, errors.New("invalid_result_schema")
	}
	for _, category := range result.Categories {
		if !slices.Contains([]string{"jailbreak", "malicious_cyber", "unauthorized_access", "other"}, category) {
			return nil, errors.New("invalid_result_category")
		}
	}
	for _, e := range result.Evidence {
		if e.Quote == "" || len(e.Quote) > 2000 || !slices.ContainsFunc(c.Messages, func(m Message) bool { return m.Index == e.MessageIndex && strings.Contains(m.Text, e.Quote) }) {
			return nil, errors.New("invalid_result_evidence")
		}
	}
	if result.Verdict == "violation" && (len(result.Evidence) == 0 || len(result.Categories) == 0) {
		return nil, errors.New("missing_violation_evidence")
	}
	return &result, nil
}
