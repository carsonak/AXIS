package catalog

import (
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"

	"axis/backend/internal/domain"
)

func Load(files fs.FS, name string) (domain.Catalog, error) {
	data, err := fs.ReadFile(files, name)
	if err != nil {
		return domain.Catalog{}, fmt.Errorf("read crop catalog: %w", err)
	}
	var result domain.Catalog
	if err := json.Unmarshal(data, &result); err != nil {
		return domain.Catalog{}, fmt.Errorf("decode crop catalog: %w", err)
	}
	if err := Validate(result); err != nil {
		return domain.Catalog{}, err
	}
	return result, nil
}

func Validate(c domain.Catalog) error {
	if c.SchemaVersion == "" || c.EngineVersion == "" {
		return errors.New("catalog versions are required")
	}
	if len(c.Crops) == 0 || len(c.IrrigationMethods) == 0 {
		return errors.New("catalog requires crops and irrigation methods")
	}
	seen := map[string]bool{}
	for _, crop := range c.Crops {
		if crop.ID == "" || seen[crop.ID] {
			return fmt.Errorf("invalid or duplicate crop id %q", crop.ID)
		}
		seen[crop.ID] = true
		total := crop.StageDays.Establishing + crop.StageDays.Developing + crop.StageDays.Productive + crop.StageDays.Maturing
		if total != crop.TotalDays || crop.TotalDays <= 0 {
			return fmt.Errorf("crop %s stage duration sum %d does not equal total %d", crop.ID, total, crop.TotalDays)
		}
		if crop.KC.Establishing <= 0 || crop.KC.Productive <= 0 || crop.KC.Maturing <= 0 {
			return fmt.Errorf("crop %s has invalid Kc", crop.ID)
		}
	}
	for _, method := range c.IrrigationMethods {
		if method.ID == "" || method.Efficiency <= 0 || method.Efficiency > 1 {
			return fmt.Errorf("invalid irrigation method %q", method.ID)
		}
	}
	return nil
}

func FindCrop(c domain.Catalog, id string) (domain.Crop, bool) {
	for _, crop := range c.Crops {
		if crop.ID == id {
			return crop, true
		}
	}
	return domain.Crop{}, false
}

func FindMethod(c domain.Catalog, id string) (domain.IrrigationMethod, bool) {
	for _, method := range c.IrrigationMethods {
		if method.ID == id {
			return method, true
		}
	}
	return domain.IrrigationMethod{}, false
}
