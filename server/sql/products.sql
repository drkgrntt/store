SELECT DISTINCT
  products.id,
  categories.name, 
  CASE categories.name WHEN 'Feature' THEN 1 ELSE 2 END AS category_order,
  products.*
FROM products

INNER JOIN product_categories
ON (products.id = product_categories.product_id)

INNER JOIN categories
ON categories.id = product_categories.category_id

GROUP BY products.id, categories.name, category_order

ORDER BY category_order, products.id, products.title

-- LIMIT ? OFFSET ?;