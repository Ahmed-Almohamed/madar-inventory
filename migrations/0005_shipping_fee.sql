ALTER TABLE sales ADD COLUMN shipping_fee_cents INTEGER NOT NULL DEFAULT 0 CHECK(shipping_fee_cents >= 0);
