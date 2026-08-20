package axis

import "embed"

// Files contains the versioned agronomy and weather fallback data used by the
// stateless service.
//
//go:embed crops.json climatology.json fixtures/recommendations/*.json fixtures/weather/*.json
var Files embed.FS
