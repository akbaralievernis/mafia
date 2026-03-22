import { useState, useEffect } from 'react';

const translations = {
  ru: {
    // Home
    home_title: 'Город засыпает.',
    home_subtitle: 'Вам нужно выжить или обмануть всех.',
    join_button: 'Присоединиться по коду',
    create_button: 'Создать свою игру',
    avatar_upload: 'Загрузить аватар',
    enter_name: 'Введите ваше имя...',
    enter_code: 'Например: M4F1A',
    join_game: 'Присоединиться к игре',
    create_room_btn: 'Создать комнату',
    close: 'Закрыть',

    // Lobby
    lobby_title: 'Код комнаты:',
    players: 'Игроки',
    invite_friends: 'Приглашайте друзей по этому коду!',
    waiting_host: 'Ожидание запуска игры хостом...',
    start_game: 'Начать игру',
    host_badge: 'Ведущий',

    // Game Roles
    role_mafia: 'Мафия',
    role_doctor: 'Доктор',
    role_detective: 'Комиссар',
    role_citizen: 'Мирный ',
    role_spectator: 'Зритель',
    hidden: 'Скрыто',
    your_role: 'Ваша роль',
    dead: 'Убит',

    // Game Phases
    phase_night: 'Ночь',
    phase_vote: 'Голосование',
    phase_day: 'День',
    round: 'Раунд',
    time_left: '⏳ Осталось:',
    sec: 'сек',

    // Game Actions
    action_required: 'Действие требуется',
    action_night: 'Выберите вашу цель на эту ночь.',
    action_vote: 'Выберите, кого изгнать на дневном голосовании.',
    confirm_choice: 'Подтвердить выбор',
    action_accepted: 'Действие принято. Ожидаем остальных...',

    // System Messages
    city_sleeps: 'Город засыпает...',
    city_sleeps_desc: 'Подождите, пока активные роли сделают свой выбор. Сохраняйте тишину.',
    revote: 'Переголосование!',
    in_game: 'В игре',
    exiled: 'Исключен',

    // Spectator Screen
    spectator_title_night: 'Ночь: Город засыпает',
    spectator_title_vote: 'Дневное голосование',
    spectator_title_day: 'День: Обсуждение',
    spectator_main_screen: 'Главный Экран',
    spectator_active_roles: 'Активные роли делают свой выбор...',
    spectator_mafia_chooses: '— 🗡️ Мафия выбирает жертву',
    spectator_doctor_chooses: '— 🛡️ Доктор спешит на помощь',
    spectator_detective_chooses: '— 🔍 Комиссар ищет мафию',
    spectator_discussion: 'Идет обсуждение. Выслушайте каждого!',

    // TTS Fallbacks
    tts_night_starts: 'Наступает ночь. Город засыпает.',
    tts_mafia_wakes: 'Просыпается мафия.',
    tts_mafia_attacks: 'Мафия выбирает жертву.',
    tts_doctor_wakes: 'Просыпается доктор и делает выбор.',
    tts_detective_wakes: 'Просыпается комиссар полици и ищет мафию.',
    tts_day_starts: 'Наступил день. Город просыпается.',
    tts_voting_time: 'Время голосования! Кого посадим в тюрьму?'
  },
  de: {
    // Home
    home_title: 'Die Stadt schläft ein.',
    home_subtitle: 'Du musst überleben oder alle täuschen.',
    join_button: 'Mit Code beitreten',
    create_button: 'Neues Spiel erstellen',
    avatar_upload: 'Avatar hochladen',
    enter_name: 'Gib deinen Namen ein...',
    enter_code: 'Zum Beispiel: M4F1A',
    join_game: 'Spiel beitreten',
    create_room_btn: 'Raum erstellen',
    close: 'Schließen',

    // Lobby
    lobby_title: 'Raumcode:',
    players: 'Spieler',
    invite_friends: 'Lade deine Freunde mit diesem Code ein!',
    waiting_host: 'Warten auf den Spielleiter...',
    start_game: 'Spiel starten',
    host_badge: 'Spielleiter',

    // Game Roles
    role_mafia: 'Mafia',
    role_doctor: 'Arzt',
    role_detective: 'Kommissar',
    role_citizen: 'Bürger',
    role_spectator: 'Zuschauer',
    hidden: 'Versteckt',
    your_role: 'Deine Rolle',
    dead: 'Getötet',

    // Game Phases
    phase_night: 'Nacht',
    phase_vote: 'Abstimmung',
    phase_day: 'Tag',
    round: 'Runde',
    time_left: '⏳ Übrig:',
    sec: 'sek',

    // Game Actions
    action_required: 'Aktion erforderlich',
    action_night: 'Wähle dein Ziel für diese Nacht.',
    action_vote: 'Wähle, wen du bei der Wahl ausschließen möchtest.',
    confirm_choice: 'Auswahl bestätigen',
    action_accepted: 'Aktion akzeptiert. Warten auf die anderen...',

    // System Messages
    city_sleeps: 'Die Stadt schläft ein...',
    city_sleeps_desc: 'Warte, bis die aktiven Rollen ihre Wahl treffen. Bleib ruhig.',
    revote: 'Neuabstimmung!',
    in_game: 'Im Spiel',
    exiled: 'Ausgeschlossen',

    // Spectator Screen
    spectator_title_night: 'Nacht: Die Stadt schläft',
    spectator_title_vote: 'Tagesabstimmung',
    spectator_title_day: 'Tag: Diskussion',
    spectator_main_screen: 'Hauptbildschirm',
    spectator_active_roles: 'Aktive Rollen treffen ihre Wahl...',
    spectator_mafia_chooses: '— 🗡️ Mafia wählt ein Opfer',
    spectator_doctor_chooses: '— 🛡️ Arzt eilt zur Hilfe',
    spectator_detective_chooses: '— 🔍 Kommissar sucht die Mafia',
    spectator_discussion: 'Die Diskussion läuft. Hör jedem zu!',

    // TTS Fallbacks
    tts_night_starts: 'Die Nacht beginnt. Die Stadt schläft ein.',
    tts_mafia_wakes: 'Die Mafia erwacht.',
    tts_mafia_attacks: 'Die Mafia wählt ein Opfer.',
    tts_doctor_wakes: 'Der Arzt erwacht und trifft seine Wahl.',
    tts_detective_wakes: 'Der Kommissar erwacht und sucht die Mafia.',
    tts_day_starts: 'Der Tag ist gekommen. Die Stadt erwacht.',
    tts_voting_time: 'Zeit zur Abstimmung! Wen schicken wir ins Gefängnis?'
  }
};

let currentLang = localStorage.getItem('mafia_lang') || 'ru';
const listeners = new Set();

export const setLanguage = (lang) => {
  if (translations[lang]) {
    currentLang = lang;
    localStorage.setItem('mafia_lang', lang);
    listeners.forEach(listener => listener(lang));
  }
};

export const getLanguage = () => currentLang;

export const t = (key) => {
  return translations[currentLang][key] || translations['ru'][key] || key;
};

export const useTranslation = () => {
  const [lang, setLangState] = useState(currentLang);

  useEffect(() => {
    const handleLangChange = (newLang) => {
      setLangState(newLang);
    };
    listeners.add(handleLangChange);
    return () => {
      listeners.delete(handleLangChange);
    };
  }, []);

  return { t, lang, setLanguage };
};

export const i18nTranslations = translations;
