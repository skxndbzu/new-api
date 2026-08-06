package model

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestValidateRedemptionInviterRewardRate(t *testing.T) {
	tests := []struct {
		name    string
		value   string
		wantErr bool
	}{
		{name: "disabled", value: "0"},
		{name: "three percent", value: "300"},
		{name: "maximum", value: "10000"},
		{name: "negative", value: "-1", wantErr: true},
		{name: "above maximum", value: "10001", wantErr: true},
		{name: "fractional basis points", value: "1.5", wantErr: true},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			err := validateOptionValue("RedemptionInviterRewardRateBps", test.value)
			if test.wantErr {
				require.Error(t, err)
				return
			}
			assert.NoError(t, err)
		})
	}
}
