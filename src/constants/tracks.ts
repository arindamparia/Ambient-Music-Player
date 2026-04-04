export const AUDIO_URLS: Record<string, string> = {
  // ── New tracks (priority) ──────────────────────────────────────────────────
  omNamahShivay: 'https://res.cloudinary.com/dnju7wfma/video/upload/v1775153821/Om_Namah_Shivay_h7hx0r.mp3',
  aadidevMahadev: 'https://res.cloudinary.com/dnju7wfma/video/upload/v1775153339/Aadidev_Mahadev_He_Shivaya_Shambho_tkoco6.mp3',
  ramSankirtan: 'https://res.cloudinary.com/dnju7wfma/video/upload/v1775154585/Shri_Ram_Naam_Sankirtanam_lnhm8t.mp3',
  healing: 'https://res.cloudinary.com/dnju7wfma/video/upload/v1774780549/HealingSound.mp3',
  windMandir: 'https://res.cloudinary.com/dnju7wfma/video/upload/v1774779620/Winds_Through_the_Old_Mandir_Flute___Sitar_in_Timeless_Tranquility_MP3_160K_llh2me.mp3',
  shivaDeep: 'https://res.cloudinary.com/dnju7wfma/video/upload/v1774779618/SHIVA___Beautiful_Indian_Background_Music___Deep___Mystical_Meditation_Music___Ambient_Hindu_Music_MP3_160K_sgrn1q.mp3',
  meditation: 'https://res.cloudinary.com/dnju7wfma/video/upload/v1774774806/Temple_Rhythms_Tabla__Flute___Sitar_Tranquility___1_Hour_Indian_Meditation_Music_MP3_160K_aspm1l.mp3',
  krishnaFlute: 'https://res.cloudinary.com/dnju7wfma/video/upload/v1774779598/Flute_of_Peace___Shri_Krishna_Relaxing_Instrumental_MP3_160K_ugj3b0.mp3',
  // ── Original tracks ────────────────────────────────────────────────────────
  rain: 'https://res.cloudinary.com/dnju7wfma/video/upload/v1774378667/rain_fe6smc.mp3',
  rain2: 'https://res.cloudinary.com/dnju7wfma/video/upload/v1774378667/rain2_uycmn6.mp3',
  ocean: 'https://res.cloudinary.com/dnju7wfma/video/upload/v1774378668/ocean_gzek2u.mp3',
  forest: 'https://res.cloudinary.com/dnju7wfma/video/upload/v1774378667/forest_l804pd.mp3',
  forest2: 'https://res.cloudinary.com/dnju7wfma/video/upload/v1774382236/forest2_xg9jbw.mp3',
  forest3: 'https://res.cloudinary.com/dnju7wfma/video/upload/v1774378667/forest3_xlypzq.mp3',
  river: 'https://res.cloudinary.com/dnju7wfma/video/upload/v1774382577/river_ffhhlr.mp3',
};

export interface Track {
  key: string;
  emoji: string;
  label: string;
  theme: string;
}

export const TRACKS: Track[] = [
  // ── New tracks first (highest priority) ───────────────────────────────────
  { key: 'omNamahShivay', emoji: '🕉️', label: 'Om Namah Shivay', theme: '#4c1d95' }, // deep purple
  { key: 'aadidevMahadev', emoji: '🏔️', label: 'Aadidev Mahadev', theme: '#1e3a8a' }, // dark blue
  { key: 'ramSankirtan', emoji: '🪷', label: 'Shri Ram Sankirtanam', theme: '#9d174d' }, // deep pink/red
  { key: 'healing', emoji: '✨', label: 'Healing Sounds', theme: '#b45309' }, // deep amber
  { key: 'windMandir', emoji: '🛕', label: 'Winds of the Mandir', theme: '#0f766e' }, // deep teal
  { key: 'shivaDeep', emoji: '🔱', label: 'Shiva — Deep Mystical', theme: '#3730a3' }, // indigo
  { key: 'meditation', emoji: '🪘', label: 'Indian Meditation', theme: '#854d0e' }, // deep yellow/brown
  { key: 'krishnaFlute', emoji: '🪈', label: 'Krishna Flute of Peace', theme: '#0369a1' }, // sky blue deep
  // ── Original tracks ────────────────────────────────────────────────────────
  { key: 'rain', emoji: '🌧️', label: 'Calming Rain', theme: '#334155' }, // slate
  { key: 'rain2', emoji: '⛈️', label: 'Rain & Thunderstorms', theme: '#1e293b' }, // dark slate
  { key: 'ocean', emoji: '🌊', label: 'Ocean Waves', theme: '#0c4a6e' }, // ocean blue
  { key: 'forest', emoji: '🌲', label: 'Forest Ambience', theme: '#14532d' }, // deep green
  { key: 'forest2', emoji: '🍃', label: 'Wind & Crickets', theme: '#166534' }, // mid green
  { key: 'forest3', emoji: '🐦', label: 'Nature Birds', theme: '#065f46' }, // emerald green
  { key: 'river', emoji: '🛶', label: 'River & Birds', theme: '#0f766e' }, // teal
];
