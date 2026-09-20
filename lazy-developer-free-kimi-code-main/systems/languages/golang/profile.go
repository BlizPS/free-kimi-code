package languageprofile

// Profile describes the default verification contract used by LazyDev for Go projects.
type Profile struct {
	ID       string
	Commands []string
	Rules    []string
}

var GoProfile = Profile{
	ID: "go",
	Commands: []string{
		"gofmt -w <changed-go-files>",
		"go test ./...",
		"go vet ./...",
		"go build ./...",
	},
	Rules: []string{
		"Format changed files with gofmt.",
		"Handle errors deliberately.",
		"Preserve package and module boundaries.",
		"Give goroutines explicit ownership and cancellation.",
	},
}
