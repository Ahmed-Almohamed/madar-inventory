CREATE TABLE product_images (
 product_id INTEGER PRIMARY KEY REFERENCES products(id),
 data_url TEXT NOT NULL
);
