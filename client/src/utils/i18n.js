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
    role_don: 'Дон мафии',
    role_mafia: 'Мафия',
    role_doctor: 'Доктор',
    role_detective: 'Комиссар',
    role_maniac: 'Маньяк',
    role_citizen: 'Мирный ',
    role_spectator: 'Зритель',
    hidden: 'Скрыто',
    your_role: 'Ваша роль',
    dead: 'Убит',

    // Role Descriptions
    desc_don: '🔍 Глава мафии. Ночью вы просыпаетесь первым и ищете Комиссара, чтобы узнать его личность. Днем голосуйте как мирный, чтобы отвести подозрения.',
    desc_mafia: '🔪 Вы в клане мафии. Ночью вы просыпаетесь вместе со своими и выбираете одну жертву. Днем притворяйтесь мирным, чтобы вас не повесили.',
    desc_doctor: '🛡️ Ваша задача — спасать людей. Каждую ночь вы выбираете одного игрока, чтобы вылечить его от нападения. Спасите тех, кто важен городу!',
    desc_detective: '🔎 Вы представитель закона. Каждую ночь вы проверяете одного игрока, чтобы узнать, мафия он или нет. Помогите мирным вычислить бандитов днем!',
    desc_maniac: '🩸 Одинокий убийца. Вы играете сами за себя. Каждую ночь вы выходите на охоту и убиваете жертву. Ваша цель — остаться последним выжившим!',
    desc_citizen: '🧑‍🌾 Мирный житель. У вас нет ночных действий (спите крепко). Ваша цель — днем анализировать поведение других и вычислить мафию!',
    desc_spectator: '👁️ Наблюдатель. Вы видите всю картину игры, следите за ночными действиями и обсуждениями, но не можете влиять на игру напрямую.',

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
    spectator_don_chooses: '— 🕴️ Дон ищет комиссара',
    spectator_mafia_chooses: '— 🗡️ Мафия выбирает жертву',
    spectator_doctor_chooses: '— 🛡️ Доктор спешит на помощь',
    spectator_detective_chooses: '— 🔍 Комиссар ищет мафию',
    spectator_maniac_chooses: '— 🔪 Маньяк вышел на охоту',
    spectator_discussion: 'Идет обсуждение. Выслушайте каждого!',

    // Game Over
    game_over: 'ИГРА ОКОНЧЕНА',
    winners_mafia: 'Победила Мафия 🩸',
    winners_citizens: 'Мирные жители спасли город 🛡️',
    return_to_lobby: 'Вернуться на главную',

    // TTS Fallbacks
    tts_night_starts: 'Наступает ночь. Город засыпает.',
    tts_don_wakes: 'Просыпается Дон мафии и ищет комиссара.',
    tts_mafia_wakes: 'Просыпается мафия.',
    tts_mafia_attacks: 'Мафия выбирает жертву.',
    tts_doctor_wakes: 'Просыпается доктор и делает выбор.',
    tts_detective_wakes: 'Просыпается комиссар полици и ищет мафию.',
    tts_maniac_wakes: 'Просыпается маньяк и выходит на охоту.',
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
    role_don: 'Don Mafia',
    role_mafia: 'Mafia',
    role_doctor: 'Arzt',
    role_detective: 'Kommissar',
    role_maniac: 'Maniac',
    role_citizen: 'Bürger',
    role_spectator: 'Zuschauer',
    hidden: 'Versteckt',
    your_role: 'Deine Rolle',
    dead: 'Getötet',

    // Role Descriptions
    desc_don: '🔍 Der Anführer der Mafia. Nachts suchen Sie als Erster nach dem Kommissar. Stimmen Sie am Tag wie ein Bürger ab, um keinen Verdacht zu erregen.',
    desc_mafia: '🔪 Du bist im Clan der Mafia. Nachts wählt ihr gemeinsam ein Opfer. Täusche am Tag alle, damit sie denken, du seist ein Bürger.',
    desc_doctor: '🛡️ Deine Aufgabe ist es, Leben zu retten. Wähle jede Nacht einen Spieler, um ihn vor einem Angriff zu schützen.',
    desc_detective: '🔎 Du bist das Gesetz. Überprüfe jede Nacht einen Spieler, um zu sehen, ob er zur Mafia gehört. Hilf der Stadt am Tag, die Banditen zu finden!',
    desc_maniac: '🩸 Ein einsamer Mörder. Du spielst nur für dich. Wähle jede Nacht ein Opfer. Dein Ziel: als Letzter am Leben zu bleiben!',
    desc_citizen: '🧑‍🌾 Ein friedlicher Bürger. Du hast nachts keine Aktionen. Dein Ziel ist es, das Verhalten der anderen am Tag zu analysieren und die Mafia zu finden!',
    desc_spectator: '👁️ Beobachter. Du siehst alles, was im Spiel passiert, kannst aber nicht direkt eingreifen.',

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
    spectator_don_chooses: '— 🕴️ Don sucht den Kommissar',
    spectator_mafia_chooses: '— 🗡️ Mafia wählt ein Opfer',
    spectator_doctor_chooses: '— 🛡️ Arzt eilt zur Hilfe',
    spectator_detective_chooses: '— 🔍 Kommissar sucht die Mafia',
    spectator_maniac_chooses: '— 🔪 Maniac geht auf die Jagd',
    spectator_discussion: 'Die Diskussion läuft. Hör jedem zu!',

    // Game Over
    game_over: 'SPIEL BEENDET',
    winners_mafia: 'Die Mafia gewinnt 🩸',
    winners_citizens: 'Die Bürger haben die Stadt gerettet 🛡️',
    return_to_lobby: 'Zurück zum Hauptmenü',

    // TTS Fallbacks
    tts_night_starts: 'Die Nacht beginnt. Die Stadt schläft ein.',
    tts_don_wakes: 'Der Don erwacht und sucht den Kommissar.',
    tts_mafia_wakes: 'Die Mafia erwacht.',
    tts_mafia_attacks: 'Die Mafia wählt ein Opfer.',
    tts_doctor_wakes: 'Der Arzt erwacht und trifft seine Wahl.',
    tts_detective_wakes: 'Der Kommissar erwacht und sucht die Mafia.',
    tts_maniac_wakes: 'Der Maniac erwacht und geht auf die Jagd.',
    tts_day_starts: 'Der Tag ist gekommen. Die Stadt erwacht.',
    tts_voting_time: 'Zeit zur Abstimmung! Wen schicken wir ins Gefängnis?'
  }
};

let currentLang = localStorage.getItem('mafia_lang') || 'ru';
const listeners = new Set();

export function setLanguage(lang) {
  if (translations[lang]) {
    currentLang = lang;
    localStorage.setItem('mafia_lang', lang);
    listeners.forEach(listener => listener(lang));
  }
}

export function getLanguage() { return currentLang; }

export function t(key) {
  return translations[currentLang][key] || translations['ru'][key] || key;
}

export function useTranslation() {
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
}

export const i18nTranslations = translations;
