-- Migration 4: Rebrand default tenant from Street Eats to ChowNow
UPDATE tenants SET name = 'ChowNow', slug = 'chownow', logo_url = '/logo.png', primary_color = '#f97316' WHERE id = 'default';
UPDATE settings SET data = REPLACE(data, '"Street Eats"', '"ChowNow"') WHERE tenant_id = 'default' AND key = 'general';
