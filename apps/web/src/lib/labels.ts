// Plain-language labels shared across pages so a copy change only happens once.

export const KIND_LABEL: Record<string, string> = {
  anomaly: "Unusual numbers",
  drift: "Definition changed",
  contradiction: "Numbers disagree",
  consensus: "Copied, not confirmed",
  benford: "Unusual pattern",
};

export const GATE_LABEL: Record<string, string> = {
  geography: "Location",
  temporal: "Time period",
  unit: "Units",
  definition: "Definition",
};

export const GATE_STATE_LABEL: Record<string, string> = {
  comparable: "Match",
  partial: "Partly match",
  not_comparable: "Don't match",
  unknown: "Not enough info",
};
