// Every country calling code the frontend's country picker can produce
// (mirrors the dial codes in Frontend/src/constants/countries.js). Sorted
// longest-first so a lookup prefers +1868 (Trinidad) over +1 when both
// prefix the same number — the same rule the frontend's dialCodeFromNumber
// helper uses.
const DIAL_CODES = [
  '+1242', '+1246', '+1268', '+1473', '+1758', '+1767', '+1784', '+1809', '+1868', '+1869',
  '+1876', '+211', '+212', '+213', '+216', '+218', '+220', '+221', '+222', '+223',
  '+224', '+226', '+227', '+228', '+229', '+230', '+231', '+232', '+233', '+234',
  '+235', '+236', '+237', '+238', '+239', '+240', '+241', '+242', '+243', '+244',
  '+245', '+248', '+249', '+250', '+251', '+252', '+253', '+254', '+255', '+256',
  '+257', '+258', '+260', '+261', '+263', '+264', '+265', '+266', '+267', '+268',
  '+269', '+291', '+351', '+352', '+353', '+354', '+355', '+356', '+357', '+358',
  '+359', '+370', '+371', '+372', '+373', '+374', '+375', '+376', '+377', '+378',
  '+379', '+380', '+381', '+382', '+383', '+385', '+386', '+387', '+389', '+420',
  '+421', '+423', '+501', '+502', '+503', '+504', '+505', '+506', '+507', '+509',
  '+591', '+592', '+593', '+595', '+597', '+598', '+670', '+673', '+674', '+675',
  '+676', '+677', '+678', '+679', '+680', '+685', '+686', '+688', '+691', '+692',
  '+850', '+855', '+856', '+880', '+886', '+960', '+961', '+962', '+963', '+965',
  '+966', '+967', '+968', '+970', '+971', '+972', '+973', '+974', '+975', '+976',
  '+977', '+992', '+993', '+994', '+995', '+996', '+998', '+20', '+27', '+30',
  '+31', '+32', '+33', '+34', '+36', '+39', '+40', '+41', '+43', '+44',
  '+45', '+46', '+47', '+48', '+49', '+51', '+52', '+53', '+54', '+55',
  '+56', '+57', '+58', '+60', '+61', '+62', '+63', '+64', '+65', '+66',
  '+81', '+82', '+84', '+86', '+90', '+91', '+92', '+93', '+94', '+95',
  '+1', '+7'
];

// The country calling code at the front of a stored/submitted E.164 number
// ("+918114491364" -> "+91"), or null when the number isn't in +<code>
// form or its prefix matches no country we know.
const dialCodeFromNumber = (mobileNumber) => {
  const raw = String(mobileNumber || '').replace(/[\s-]/g, '');

  if (!raw.startsWith('+')) return null;

  return DIAL_CODES.find((code) => raw.startsWith(code)) || null;
};

// The national significant number — everything after the country calling
// code ("+918114491364" -> "8114491364"). Null when no dial code could be
// identified, since without one there's no way to say where the country
// code ends and the subscriber number begins.
const nationalNumberFrom = (mobileNumber) => {
  const raw = String(mobileNumber || '').replace(/[\s-]/g, '');
  const dialCode = dialCodeFromNumber(raw);

  if (!dialCode) return null;

  const national = raw.slice(dialCode.length);

  return /^\d+$/.test(national) ? national : null;
};

module.exports = { DIAL_CODES, dialCodeFromNumber, nationalNumberFrom };
