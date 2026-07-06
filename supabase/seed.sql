-- Sample lookup data for local/dev.
insert into cost_centers (code, name) values
  ('CC-OPS',  'Operations'),
  ('CC-MKT',  'Marketing'),
  ('CC-TECH', 'Technology'),
  ('CC-FIN',  'Finance')
on conflict (code) do nothing;

insert into stock_items (name, unit, quantity, returnable) values
  ('A4 Standee',        'unit', 120, false),
  ('Laptop (loaner)',   'unit',   8, true),
  ('Projector',         'unit',   3, true),
  ('A4 Paper',          'ream',  40, false),
  ('Company T-Shirt',   'unit', 200, false)
on conflict do nothing;
