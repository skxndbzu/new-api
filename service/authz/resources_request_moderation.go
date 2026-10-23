package authz

const ResourceRequestModeration = "request_moderation"

var (
	RequestModerationRead     = Permission{Resource: ResourceRequestModeration, Action: ActionRead}
	RequestModerationBody     = Permission{Resource: ResourceRequestModeration, Action: "body"}
	RequestModerationWrite    = Permission{Resource: ResourceRequestModeration, Action: ActionWrite}
	RequestModerationReview   = Permission{Resource: ResourceRequestModeration, Action: "review"}
	RequestModerationRestrict = Permission{Resource: ResourceRequestModeration, Action: "restrict"}
)

func init() {
	RegisterResource(ResourceDefinition{Resource: ResourceRequestModeration, LabelKey: "Request moderation", Actions: []ActionDefinition{
		{Action: ActionRead, LabelKey: "View moderation records", DefaultRoles: []string{BuiltInRoleAdmin}},
		{Action: "body", LabelKey: "View moderated content"},
		{Action: ActionWrite, LabelKey: "Configure request moderation"},
		{Action: "review", LabelKey: "Review moderation decisions"},
		{Action: "restrict", LabelKey: "Manage moderation restrictions"},
	}})
}
