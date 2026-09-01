-- Seed content from the LORE spreadsheet and Drive folder (Sept 2026).
-- Moment dates marked 'approx' were bulk-upload dates in the source sheet, not
-- real event dates; owners can correct them in the app.

do $seed$
declare
  cat_company uuid; cat_fundraising uuid; cat_product uuid; cat_brand uuid;
  cat_events uuid; cat_team uuid;
  m uuid; p_author uuid; mo uuid;
begin
  select id into cat_company from categories where slug = 'company';
  select id into cat_fundraising from categories where slug = 'fundraising';
  select id into cat_product from categories where slug = 'product';
  select id into cat_brand from categories where slug = 'brand';
  select id into cat_events from categories where slug = 'events';
  select id into cat_team from categories where slug = 'team';

  -- People (emails filled in where known; linked to auth users at first sign-in)
  insert into people (full_name, email) values
    ('Maddie', 'maddie@listenlabs.ai'),
    ('Diana', 'diana@listenlabs.ai'),
    ('Alfred', null),
    ('Erik', null),
    ('Florian', null),
    ('Bobby', null),
    ('Brendan', null),
    ('Joel', null),
    ('Tobias', null);

  -- Milestones (dates pending Brannon's worksheet stay null / approx)
  insert into milestones (title, category_id, date_start, date_end, date_precision, location, blurb) values
    ('Founding', cat_company, null, null, 'approx', null, null),
    ('Y Combinator', cat_company, null, null, 'approx', null, null),
    ('Seed Round', cat_fundraising, null, null, 'approx', null, null),
    ('Series A', cat_fundraising, null, null, 'approx', null, null),
    ('Series A Party', cat_events, null, null, 'approx', null, null),
    ('Series B', cat_fundraising, null, null, 'approx', null, null),
    ('Series B Video', cat_brand, '2025-12-13', null, 'day', 'Los Angeles', 'Filming the Series B announcement video in LA'),
    ('Series B Party', cat_events, '2026-03-20', null, 'day', 'San Francisco', 'Berghain-themed Series B launch party'),
    ('Series C', cat_fundraising, null, null, 'approx', null, null),
    ('Pulse Launch', cat_product, null, null, 'approx', null, null),
    ('Billboard no.1', cat_brand, '2026-05-26', null, 'approx', 'San Francisco', 'The first billboard'),
    ('Billboard no.2', cat_brand, null, null, 'approx', null, null),
    ('NYC OOH', cat_brand, null, null, 'approx', 'New York', null),
    ('Awards', cat_brand, null, null, 'approx', null, null),
    ('Santa Barbara Offsite', cat_events, '2026-05-26', null, 'approx', 'Santa Barbara', 'Company offsite and hackathon'),
    ('Holiday Offsite', cat_events, '2025-12-11', null, 'day', 'San Rafael', 'Holiday mini offsite'),
    ('Tokyo Record Bar', cat_events, null, null, 'approx', null, null),
    ('Ladies Who Listen no.1', cat_events, null, null, 'approx', null, null),
    ('Ladies Who Listen no.2', cat_events, null, null, 'approx', null, null),
    ('NYC Office', cat_team, null, null, 'approx', 'New York', null),
    ('Ladies of Listen', cat_team, null, null, 'approx', null, null),
    ('100 Employees', cat_company, null, null, 'approx', null, null),
    ('Hawaii Offsite', cat_events, '2026-09-08', '2026-09-11', 'day', 'Hawaii', 'Company offsite in Hawaii');

  -- ---- Moments -----------------------------------------------------------

  -- helper pattern: insert moment, capture id, attach tags + media

  select id into p_author from people where full_name = 'Maddie';
  select id into m from milestones where title = 'Series B Video';
  insert into moments (title, body, category_id, milestone_id, author_person_id, event_date, date_precision, location)
  values ('Flew to LA to shoot our Series B video', null, cat_brand, m, p_author, '2025-12-13', 'day', 'Los Angeles')
  returning id into mo;
  insert into moment_people select mo, id from people where full_name in ('Alfred', 'Diana', 'Maddie');
  insert into media (owner_type, moment_id, storage_path, sort) values
    ('moment', mo, 'seed/brand_seriesbvideo_12-13-2025-1.jpg', 0),
    ('moment', mo, 'seed/brand_seriesbvideo_12-13-2025-2.jpg', 1);

  select id into m from milestones where title = 'Holiday Offsite';
  insert into moments (title, body, category_id, milestone_id, author_person_id, event_date, date_precision, location)
  values ('Private chef dinner at the holiday mini offsite', null, cat_events, m, p_author, '2025-12-11', 'day', 'San Rafael')
  returning id into mo;
  insert into media (owner_type, moment_id, storage_path) values
    ('moment', mo, 'seed/events_holidayoffsite_12-11-2025.jpg');

  select id into m from milestones where title = 'Series B Party';
  insert into moments (title, body, category_id, milestone_id, author_person_id, event_date, date_precision, location)
  values ('Berghain-themed launch party', null, cat_events, m, p_author, '2026-03-20', 'day', 'San Francisco')
  returning id into mo;
  insert into media (owner_type, moment_id, storage_path) values
    ('moment', mo, 'seed/events_seriesbparty_03-20-2026.jpg');

  select id into p_author from people where full_name = 'Diana';

  select id into m from milestones where title = 'Billboard no.1';
  insert into moments (title, body, category_id, milestone_id, author_person_id, event_date, date_precision, location)
  values ('Alfred telling the CBS reporter we spent $20k on the billboard', null, cat_brand, m, p_author, '2026-05-26', 'approx', 'San Francisco')
  returning id into mo;
  insert into moment_people select mo, id from people where full_name = 'Alfred';
  insert into media (owner_type, moment_id, storage_path) values
    ('moment', mo, 'seed/brand_billboardno1_05-26-2026.jpg');

  select id into m from milestones where title = 'Santa Barbara Offsite';

  insert into moments (title, body, category_id, milestone_id, author_person_id, event_date, date_precision, location)
  values ('Offsite hackathon', null, cat_events, m, p_author, '2026-05-26', 'approx', 'Santa Barbara')
  returning id into mo;
  insert into media (owner_type, moment_id, storage_path, sort) values
    ('moment', mo, 'seed/events_santabarbaraoffsite_05-26-2026-1.jpg', 0),
    ('moment', mo, 'seed/events_santabarbaraoffsite_05-26-2026-2.jpg', 1),
    ('moment', mo, 'seed/events_santabarbaraoffsite_05-26-2026-3.jpg', 2);

  insert into moments (title, body, category_id, milestone_id, author_person_id, event_date, date_precision, location)
  values ('$70 refund for expired potato chips in hotel catering', null, cat_events, m, p_author, '2026-05-26', 'approx', 'Santa Barbara')
  returning id into mo;
  insert into moment_people select mo, id from people where full_name in ('Diana', 'Joel');
  insert into media (owner_type, moment_id, storage_path) values
    ('moment', mo, 'seed/events_santabarbaraoffsite_05-26-2026-4.jpg');

  insert into moments (title, body, category_id, milestone_id, author_person_id, event_date, date_precision, location)
  values ('Salt mine meditation', null, cat_events, m, p_author, '2026-05-26', 'approx', 'Santa Barbara')
  returning id into mo;
  insert into media (owner_type, moment_id, storage_path) values
    ('moment', mo, 'seed/events_santabarbaraoffsite_05-26-2026-5.jpg');

  insert into moments (title, body, category_id, milestone_id, author_person_id, event_date, date_precision, location)
  values ('Founders flying economy and sharing a hotel room', null, cat_events, m, p_author, '2026-05-26', 'approx', 'Santa Barbara')
  returning id into mo;
  insert into media (owner_type, moment_id, storage_path) values
    ('moment', mo, 'seed/events_santabarbaraoffsite_05-26-2026-6.jpg');

  -- Team moments (float free of milestones for now)

  insert into moments (title, body, category_id, author_person_id, event_date, date_precision, location)
  values ('Our first ever merch', null, cat_team, p_author, '2026-05-26', 'approx', 'San Francisco')
  returning id into mo;
  insert into media (owner_type, moment_id, storage_path) values
    ('moment', mo, 'seed/team_firstmerch_05-26-2026.jpg');

  insert into moments (title, body, category_id, author_person_id, event_date, date_precision, location)
  values ('The ban of the diet cokes', null, cat_team, p_author, '2026-05-26', 'approx', 'San Francisco')
  returning id into mo;
  insert into media (owner_type, moment_id, storage_path) values
    ('moment', mo, 'seed/team_dietcokeban_05-26-2026.jpg');

  insert into moments (title, body, category_id, author_person_id, event_date, date_precision, location)
  values ('When we first introduced no shoes, very controversial', null, cat_team, p_author, '2026-05-26', 'approx', 'San Francisco')
  returning id into mo;
  insert into media (owner_type, moment_id, storage_path) values
    ('moment', mo, 'seed/team_noshoes_05-26-2026.jpg');

  insert into moments (title, body, category_id, author_person_id, event_date, date_precision, location)
  values ('Arm wrestling game that led to our first candidate signing on the spot', null, cat_team, p_author, '2026-05-26', 'approx', 'San Francisco')
  returning id into mo;
  insert into media (owner_type, moment_id, storage_path) values
    ('moment', mo, 'seed/team_armwrestling_05-26-2026.jpg');

  insert into moments (title, body, category_id, author_person_id, event_date, date_precision, location)
  values ('Dynamic duo', 'Including the bike pic.', cat_team, p_author, '2026-05-26', 'approx', 'San Francisco')
  returning id into mo;
  insert into media (owner_type, moment_id, storage_path, sort) values
    ('moment', mo, 'seed/team_dynamicduo_05-26-2026-1.jpg', 0),
    ('moment', mo, 'seed/team_dynamicduo_05-26-2026-2.jpg', 1);

  insert into moments (title, body, category_id, author_person_id, event_date, date_precision, location)
  values ('Alfred''s birthday', null, cat_team, p_author, '2026-05-26', 'approx', 'San Francisco')
  returning id into mo;
  insert into moment_people select mo, id from people where full_name = 'Alfred';
  insert into media (owner_type, moment_id, storage_path, sort) values
    ('moment', mo, 'seed/team_alfredbday_05-26-2026-1.jpg', 0),
    ('moment', mo, 'seed/team_alfredbday_05-26-2026-2.jpg', 1);

  insert into moments (title, body, category_id, author_person_id, event_date, date_precision, location)
  values ('Progression of fikas', null, cat_team, p_author, '2026-05-26', 'approx', 'San Francisco')
  returning id into mo;
  insert into media (owner_type, moment_id, storage_path, sort) values
    ('moment', mo, 'seed/team_fikas_05-26-2026-1.jpg', 0),
    ('moment', mo, 'seed/team_fikas_05-26-2026-2.jpg', 1),
    ('moment', mo, 'seed/team_fikas_05-26-2026-3.jpg', 2),
    ('moment', mo, 'seed/team_fikas_05-26-2026-4.jpg', 3),
    ('moment', mo, 'seed/team_fikas_05-26-2026-5.jpg', 4),
    ('moment', mo, 'seed/team_fikas_05-26-2026-6.jpg', 5);

  insert into moments (title, body, category_id, author_person_id, event_date, date_precision)
  values ('Bobby and Brendan attending conferences and booking meetings in their first week', null, cat_team, p_author, '2026-05-26', 'approx')
  returning id into mo;
  insert into moment_people select mo, id from people where full_name in ('Bobby', 'Brendan');
  insert into media (owner_type, moment_id, storage_path, sort) values
    ('moment', mo, 'seed/team_firstweekconferences_05-26-2026-1.jpg', 0),
    ('moment', mo, 'seed/team_firstweekconferences_05-26-2026-2.jpg', 1);

  insert into moments (title, body, category_id, author_person_id, event_date, date_precision, location)
  values ('Old office single toilet that was broken', null, cat_team, p_author, '2026-05-26', 'approx', 'San Francisco')
  returning id into mo;
  insert into moment_people select mo, id from people where full_name = 'Tobias';
  insert into media (owner_type, moment_id, storage_path) values
    ('moment', mo, 'seed/team_oldoffice_05-26-2026-1.jpg');

  select id into p_author from people where full_name = 'Erik';
  insert into moments (title, body, category_id, author_person_id, event_date, date_precision, location)
  values ('Early office, right around when Erik signed', null, cat_team, p_author, '2026-05-26', 'approx', 'San Francisco')
  returning id into mo;
  insert into moment_people select mo, id from people where full_name = 'Erik';
  insert into media (owner_type, moment_id, storage_path) values
    ('moment', mo, 'seed/team_oldoffice_05-26-2026-2.jpg');

  select id into p_author from people where full_name = 'Diana';
  insert into moments (title, body, category_id, author_person_id, event_date, date_precision, location)
  values ('Florian''s bday while Alfred was stuck in Europe on visa issues (but secured the $$$)', null, cat_team, p_author, '2026-05-26', 'approx', 'San Francisco')
  returning id into mo;
  insert into moment_people select mo, id from people where full_name = 'Florian';
  insert into media (owner_type, moment_id, storage_path) values
    ('moment', mo, 'seed/team_florianbday_05-26-2026.jpg');

  insert into moments (title, body, category_id, author_person_id, event_date, date_precision)
  values ('The Blade ride', null, cat_team, p_author, '2026-05-26', 'approx')
  returning id into mo;
  insert into media (owner_type, moment_id, storage_path, sort) values
    ('moment', mo, 'seed/team_bladeride_05-26-2026-1.jpg', 0),
    ('moment', mo, 'seed/team_bladeride_05-26-2026-2.jpg', 1);
end $seed$;
