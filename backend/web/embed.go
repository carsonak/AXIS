package web

import (
	"embed"
	"io/fs"
)

// content contains the generated production PWA when a frontend build has run,
// plus a source-controlled marker and fallback page for a fresh checkout.
//
//go:embed all:dist all:fallback
var content embed.FS

// StaticFiles returns the generated PWA when it is present and otherwise
// returns the fallback page. Generated Vite assets do not need to be committed.
func StaticFiles() (fs.FS, error) {
	if _, err := fs.Stat(content, "dist/generated/index.html"); err == nil {
		return fs.Sub(content, "dist/generated")
	}
	return fs.Sub(content, "fallback")
}
