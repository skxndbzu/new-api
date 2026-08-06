package router

import (
	"bytes"
	"embed"
	"io"
	"io/fs"
	"mime"
	"net/http"
	"net/url"
	"path"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/controller"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/gin-contrib/gzip"
	"github.com/gin-contrib/static"
	"github.com/gin-gonic/gin"
)

// WebAssets holds the embedded dashboard frontend and docs assets.
type WebAssets struct {
	BuildFS          embed.FS
	IndexPage        []byte
	DocsBuildFS      embed.FS
}

func SetWebRouter(router *gin.Engine, assets WebAssets) {
	frontendFS := common.EmbedFolder(assets.BuildFS, "web/dist")

	router.Use(gzip.Gzip(gzip.DefaultCompression))
	router.Use(middleware.GlobalWebRateLimit())
	router.Use(middleware.Cache())
	setDocsRouter(router, assets.DocsBuildFS)
	router.Use(static.Serve("/", frontendFS))
	router.NoRoute(func(c *gin.Context) {
		c.Set(middleware.RouteTagKey, "web")
		if strings.HasPrefix(c.Request.RequestURI, "/v1") || strings.HasPrefix(c.Request.RequestURI, "/api") || strings.HasPrefix(c.Request.RequestURI, "/assets") {
			controller.RelayNotFound(c)
			return
		}
		c.Header("Cache-Control", "no-cache")
		c.Data(http.StatusOK, "text/html; charset=utf-8", assets.IndexPage)
	})
}

func setDocsRouter(router *gin.Engine, docsBuildFS embed.FS) {
	docsFS, err := fs.Sub(docsBuildFS, "web/docs")
	if err != nil {
		panic(err)
	}

	router.GET("/docs", func(c *gin.Context) {
		c.Redirect(http.StatusMovedPermanently, "/docs/")
	})
	router.GET("/docs/*filepath", func(c *gin.Context) {
		requestPath := strings.TrimPrefix(c.Param("filepath"), "/")
		if requestPath != "" && isDocsHomeAlias(requestPath) {
			c.Redirect(http.StatusMovedPermanently, "/docs/")
			return
		}
		serveDocsFile(c, docsFS, requestPath)
	})
}

func serveDocsFile(c *gin.Context, docsFS fs.FS, requestPath string) {
	name, statusCode := resolveDocsFile(docsFS, requestPath)
	file, err := docsFS.Open(name)
	if err != nil {
		c.Status(http.StatusNotFound)
		return
	}
	defer file.Close()

	stat, err := file.Stat()
	if err != nil || stat.IsDir() {
		c.Status(http.StatusNotFound)
		return
	}

	if contentType := mime.TypeByExtension(path.Ext(name)); contentType != "" {
		c.Header("Content-Type", contentType)
	}

	if statusCode != http.StatusOK {
		data, err := io.ReadAll(file)
		if err != nil {
			c.Status(http.StatusInternalServerError)
			return
		}
		c.Data(statusCode, c.Writer.Header().Get("Content-Type"), data)
		return
	}

	if seeker, ok := file.(io.ReadSeeker); ok {
		http.ServeContent(c.Writer, c.Request, path.Base(name), stat.ModTime(), seeker)
		return
	}

	data, err := io.ReadAll(file)
	if err != nil {
		c.Status(http.StatusInternalServerError)
		return
	}
	http.ServeContent(c.Writer, c.Request, path.Base(name), stat.ModTime(), bytes.NewReader(data))
}

func resolveDocsFile(docsFS fs.FS, requestPath string) (string, int) {
	cleanPath := strings.TrimPrefix(path.Clean("/"+requestPath), "/")
	if cleanPath == "." {
		cleanPath = ""
	}

	candidates := make([]string, 0, 5)
	if cleanPath == "" {
		candidates = append(candidates, "index.html")
	} else if strings.HasSuffix(requestPath, "/") {
		candidates = append(candidates, path.Join(cleanPath, "index.html"))
	} else {
		candidates = append(candidates, cleanPath)
		if path.Ext(cleanPath) == "" {
			candidates = append(candidates, cleanPath+".html", path.Join(cleanPath, "index.html"))
		}
	}
	for _, candidate := range candidates {
		if info, err := fs.Stat(docsFS, candidate); err == nil && !info.IsDir() {
			return candidate, http.StatusOK
		}
	}

	if info, err := fs.Stat(docsFS, "404.html"); err == nil && !info.IsDir() {
		return "404.html", http.StatusNotFound
	}
	return "index.html", http.StatusNotFound
}

func isDocsHomeAlias(requestPath string) bool {
	cleanPath := strings.Trim(strings.TrimPrefix(path.Clean("/"+requestPath), "/"), "/")
	if decoded, err := url.PathUnescape(cleanPath); err == nil {
		cleanPath = decoded
	}

	switch strings.ToLower(strings.TrimSpace(cleanPath)) {
	case ".", "index", "index.html", "home", "文档", "首页", "文档首页":
		return true
	default:
		return false
	}
}
