package catalog

import (
	"testing"

	axisassets "axis"
)

func TestEmbeddedCatalogIsValid(t *testing.T) {
	cat, err := Load(axisassets.Files, "crops.json")
	if err != nil {
		t.Fatal(err)
	}
	if len(cat.Crops) < 3 || len(cat.IrrigationMethods) < 3 {
		t.Fatal("expected the hackathon crop and method catalog")
	}
	for _, crop := range cat.Crops {
		total := crop.StageDays.Establishing + crop.StageDays.Developing + crop.StageDays.Productive + crop.StageDays.Maturing
		if total != crop.TotalDays {
			t.Fatalf("%s stage total mismatch", crop.ID)
		}
	}
}
