package service

import (
	"bytes"
	"encoding/json"
	"log/slog"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestSubMSV2194UsageTTFTContract(t *testing.T) {
	// These endpoints are from v2.19.4, not inferred from the new semantic
	// observer. Native WS uses the unchanged shared response_semantic helper.
	for _, tc := range []struct {
		name, payload string
		want          bool
	}{
		{"created", `{"type":"response.created"}`, false},
		{"queued", `{"type":"response.queued"}`, false},
		{"in_progress", `{"type":"response.in_progress"}`, false},
		{"metadata", `{"type":"response.metadata"}`, false},
		{"heartbeat", `{"type":"keepalive"}`, false},
		{"done_marker", `[DONE]`, false},
		{"empty_message_item", `{"type":"response.output_item.added","item":{"type":"message","content":[]}}`, true},
		{"empty_delta", `{"type":"response.output_text.delta","delta":""}`, true},
		{"text", `{"type":"response.output_text.delta","delta":"hello"}`, true},
		{"reasoning", `{"type":"response.reasoning_text.delta","delta":"thinking"}`, true},
		{"completion", `{"type":"response.completed","response":{"output":[]}}`, true},
		{"retryable_failure", `{"type":"response.failed","response":{"error":{"code":"server_error"}}}`, false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			require.Equal(t, tc.want, openAIStreamDataStartsTTFT(tc.payload, "", false, OpenAITTFTModeSemantic))
		})
	}
	require.False(t, openAIStreamDataStartsTTFT(`{"type":"response.output_text.delta","delta":""}`, "", false, OpenAITTFTModeVisible))
	require.True(t, openAIStreamDataStartsTTFT(`{"type":"response.output_text.delta","delta":"hello"}`, "", false, OpenAITTFTModeVisible))
}

func TestSubMSAPIKeyFastBillingBoundaries(t *testing.T) {
	for _, tc := range []struct {
		name, requested, observed, want string
		responseBilling, retained       bool
	}{
		{"priority_default", "priority", "default", "priority", false, true},
		{"fast_alias", "fast", "default", "fast", false, true},
		{"normal", "", "default", "", false, false},
		{"filtered_by_policy", "", "priority", "", false, false},
		{"standard", "default", "default", "default", false, false},
		{"missing_response", "priority", "", "priority", false, false},
		{"explicit_flex", "priority", "flex", "flex", false, false},
		{"explicit_actual_response", "priority", "default", "default", true, false},
		{"not_a_fast_upgrade", "", "ultrafast", "", false, false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			account := &Account{Platform: PlatformOpenAI, Type: AccountTypeAPIKey, Extra: map[string]any{OpenAIResponseTierBillingEnabledKey: tc.responseBilling}}
			tier := tc.requested
			result := &OpenAIForwardResult{ServiceTier: &tier, UpstreamResponseServiceTier: tc.observed}
			got := ApplyOpenAIServiceTierBillingResolution(account, result)
			require.Equal(t, tc.want, optionalStringValue(result.ServiceTier))
			require.Equal(t, tc.retained, got.RequestBilling)
			require.Equal(t, tc.observed, result.UpstreamResponseServiceTier, "raw upstream evidence is never rewritten")
		})
	}
}

func TestSubMSAPIKeyFastMismatchAudit(t *testing.T) {
	var output bytes.Buffer
	previous := slog.Default()
	slog.SetDefault(slog.New(slog.NewJSONHandler(&output, nil)))
	t.Cleanup(func() { slog.SetDefault(previous) })
	account := &Account{ID: 1, Platform: PlatformOpenAI, Type: AccountTypeAPIKey}
	logServiceTierBillingDowngrade("fixture", account, "synthetic-fast", ResolveOpenAIServiceTierBilling(account, "priority", "default"))
	var entry map[string]any
	require.NoError(t, json.Unmarshal(output.Bytes(), &entry))
	require.Equal(t, "priority", entry["requested_tier"])
	require.Equal(t, "default", entry["response_tier"])
	require.Equal(t, "priority", entry["billed_tier"])
	require.Equal(t, "outbound_request", entry["tier_source"])
}
