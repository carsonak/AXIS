package web

import (
	"embed"
	"io/fs"
)

// content contains the generated production PWA when a frontend build has run,
// plus a source-controlled fallback page for a fresh source-only checkout.
//
//go:embed all:dist all:fallback
var content embed.FS

// StaticFiles returns the generated PWA when it is present and otherwise
// returns the fallback page. Generated Vite assets do not need to be committed.
func StaticFiles() (fs.FS, error) {
	dist, err := fs.Sub(content, "dist")
	if err != nil {
		return nil, err
	}
	if _, err := fs.Stat(dist, "index.html"); err == nil {
		return dist, nil
	}
	return fs.Sub(content, "fallback")
}
