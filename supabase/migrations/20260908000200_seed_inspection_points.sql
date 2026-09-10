-- ============================================================================
-- THE 16 INSPECTION POINTS
--
-- Reference data, not demo data: transcribed verbatim from Frutta's paper
-- audit form. It lives in a migration rather than seed.sql so that a hosted
-- `db push` gets it too, and so `db reset` cannot insert it twice.
--
-- 'critical' marks the three points where a failure means someone could
-- actually get ill. 'require_photo_on_fail' marks the three where a photo is
-- the only credible evidence the problem was found and dealt with.
-- ============================================================================

insert into public.inspection_points
  (serial, section, text, critical, require_photo_on_fail)
values
  (1,  'Raw Material',      'All the raw material are stored in proper storage areas', false, true),
  (2,  'Raw Material',      'FIFO standards are followed for Raw material usage', false, false),
  (3,  'Storage Measures',  'Items are labelled and stored', false, true),
  (4,  'Storage Measures',  'All the vegetables and dry items are stored in proper temperature conditions', false, false),
  (5,  'Storage Measures',  'Poultry & other sea foods products is procured & maintained at specified temperature', true, false),
  (6,  'Storage Measures',  'All items are stored in closed containers', false, false),
  (7,  'Food Preparation',  'Proper use and maintenance of kitchen equipment to ensure safety and efficiency', false, false),
  (8,  'Food Preparation',  'Adherence to food safety guidelines during food preparation, such as proper cooking temperatures and handling of raw ingredients', true, false),
  (9,  'Hygiene Measures',  'Food equipments, utensils and food contact surface are properly washed, rinsed and sanitized before every use', true, false),
  (10, 'Hygiene Measures',  'Personal hygiene is followed by Kitchen staff', false, false),
  (11, 'Hygiene Measures',  'The premises of work place is well maintained and sanitized after every session', false, false),
  (12, 'Waste Disposal',    'Waste bins are not overflowing and are emptied regularly', false, true),
  (13, 'Dispatch Measures', 'All the items mentioned in the menu is checked before despatch', false, false),
  (14, 'Dispatch Measures', 'Items are despatched in clean vessels', false, false),
  (15, 'Dispatch Measures', 'All Items are tasted before packing', false, false),
  (16, 'Dispatch Measures', 'Kitchen should maintain the mentioned time for food pickup', false, false);
