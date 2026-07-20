
// Shared identity-display cycle used by the single flip icon in the header
// (top-right, beside the back button) once a receiver's been found. One
// tap advances both the sender and receiver card through the same four
// faces together: name → Gloobal ID → mobile number → country name → back
// to name.
export const IDENTITY_DISPLAY_ORDER = ["name", "id", "mobile", "country"];

export const IDENTITY_DISPLAY_LABEL = {
  name: "name",
  id: "Gloobal ID",
  mobile: "mobile number",
  country: "country name",
};

export function nextIdentityMode(mode) {
  const i = IDENTITY_DISPLAY_ORDER.indexOf(mode);
  return IDENTITY_DISPLAY_ORDER[(i + 1) % IDENTITY_DISPLAY_ORDER.length];
}

// Pulls whichever field a given display mode calls for out of a
// sender/receiver profile object (both shapes carry name/id/phone/country).
export function identityDisplayValue(profile, mode) {
  switch (mode) {
    case "id":
      return profile.id;
    case "mobile":
      return profile.phone;
    case "country":
      return profile.country;
    case "name":
    default:
      return profile.name;
  }
}
