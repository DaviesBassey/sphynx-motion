-- SPHYNX MOTION · Extended Language Seed
-- Run after 003_i18n.sql
-- Adds languages missing from the initial seed

INSERT INTO public.languages (code, name, native_name) VALUES
  ('nso', 'Sepedi',          'Sesepedi'),
  ('ve',  'Tshivenda',       'Tshivenḓa'),
  ('ts',  'Tsonga',          'Xitsonga'),
  ('pcm', 'Nigerian Pidgin', 'Naijá'),
  ('ar',  'Arabic',          'العربية')
ON CONFLICT (code) DO NOTHING;

-- Arabic is RTL — set flag whether it was just inserted or already existed
UPDATE public.languages SET is_rtl = TRUE WHERE code = 'ar';

-- Correct display names that shipped with generic labels
UPDATE public.languages SET name = 'Zulu',     native_name = 'isiZulu'   WHERE code = 'zu' AND name = 'Zulu';
UPDATE public.languages SET name = 'Xhosa',    native_name = 'isiXhosa'  WHERE code = 'xh' AND name = 'Xhosa';
UPDATE public.languages SET name = 'Sesotho',  native_name = 'Sesotho'   WHERE code = 'st';
UPDATE public.languages SET name = 'Setswana', native_name = 'Setswana'  WHERE code = 'tn';
UPDATE public.languages SET name = 'Swahili',  native_name = 'Kiswahili' WHERE code = 'sw';
