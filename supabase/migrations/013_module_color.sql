-- Add color, icon_shape, and text_color customization to modules
ALTER TABLE modules ADD COLUMN IF NOT EXISTS color TEXT DEFAULT 'blue';
ALTER TABLE modules ADD COLUMN IF NOT EXISTS icon_shape TEXT DEFAULT 'rounded';
ALTER TABLE modules ADD COLUMN IF NOT EXISTS text_color TEXT DEFAULT NULL;
