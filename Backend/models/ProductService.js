const mongoose = require('mongoose');

// One row per line in a product screen's "Our Services" list, plus the
// product's own live flag carried on every row of that product.
//
// These four lines per product used to be written into the app bundle with
// an unconditional green tick beside each, so "Taxless" and "Limitless"
// read as shipped features on a Gloobal Bank that has no tax handling and
// caps every transfer. Correcting that in code fixed the claim but not the
// mechanism: the next correction still needed a developer and a deploy.
//
// This is the mechanism. Rows live here, are read by
// GET /api/products/:product, and can be edited straight in Atlas — a
// service goes live by changing one field, not by shipping a build.
//
// The app keeps its own copy of this list as an offline fallback, because
// Render sleeps and a screen that renders nothing while the backend wakes
// up is worse than a screen showing a slightly stale status.
const ProductServiceSchema = new mongoose.Schema({
  product: { type: String, enum: ['bank', 'coin'], required: true },
  label: { type: String, required: true },
  // live    — works today
  // planned — not built; `note` is what is missing
  status: { type: String, enum: ['live', 'planned'], default: 'planned' },
  note: { type: String, default: '' },
  // Display order within the product. Explicit rather than relying on
  // insertion order, so reordering is an edit and not a re-insert.
  order: { type: Number, default: 0 }
}, { timestamps: true });

// A product has one row per label.
ProductServiceSchema.index({ product: 1, label: 1 }, { unique: true });
ProductServiceSchema.index({ product: 1, order: 1 });

module.exports = mongoose.model('ProductService', ProductServiceSchema);
