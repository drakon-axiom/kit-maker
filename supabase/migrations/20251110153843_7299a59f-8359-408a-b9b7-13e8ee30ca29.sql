-- Insert quote template settings
INSERT INTO settings (key, value, description) VALUES
  ('company_name', 'Nexus Aminos', 'Company name shown in quote emails'),
  ('company_email', 'info@nexusaminos.com', 'Company contact email shown in quotes'),
  ('quote_header_bg_color', '#c2e4fb', 'Background color for quote email header (hex code)'),
  ('quote_header_text_color', '#000000', 'Text color for quote email header (hex code)'),
  ('quote_footer_text', 'We look forward to working with you!', 'Footer message in quote emails')
ON CONFLICT (key) DO NOTHING;