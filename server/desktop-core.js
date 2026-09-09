const CONFIG = Object.freeze({
  version: '2.0.0',
  spreadsheetId: 'workspace',
  contentPlan: {
    spreadsheetId: 'content',
    sheetName: 'Лист1'
  },
  timeZone: 'Europe/Moscow',
  sheets: {
    tasks: 'Задачи',
    settings: 'Настройки',
    journal: 'Дневник',
    calendar: 'Календарь',
    aiProjects: 'ИИ‑проекты',
    aiEvents: 'События проектов',
    achievements: 'Достижения'
  },
  taskStartRow: 6,
  maxTextLength: 5000
});

function getDashboardData(requestedDate) {
  const ss = getSpreadsheet_();
  const warnings = [];
  const date = normalizeDate_(requestedDate);
  const isoDate = formatDate_(date, 'yyyy-MM-dd');
  const dayIndex = isoDayIndex_(date);

  safelyRead_('Дневник', function () {
    ensureJournal_(ss);
    return true;
  }, false, warnings);

  const tasks = safelyRead_('Задачи', function () {
    return getTasks_(ss);
  }, [], warnings);
  const events = safelyRead_('Календарь', function () {
    return getCalendarEvents_(ss);
  }, [], warnings);
  const calendarEvents = safelyRead_('Ближайшие события', function () {
    return getUpcomingCalendarEvents_(events);
  }, [], warnings);
  const schedule = safelyRead_('Расписание дня', function () {
    return getDaySchedule_(ss, dayIndex);
  }, [], warnings);
  const week = safelyRead_('Неделя', function () {
    return getWeekSchedule_(ss);
  }, [], warnings);
  const daily = safelyRead_('Записи дня', function () {
    return getDaily_(ss, isoDate);
  }, emptyDaily_(isoDate), warnings);

  return {
    date: {
      iso: isoDate,
      title: russianDate_(date),
      dayIndex: dayIndex,
      dayName: dayNames_()[dayIndex - 1]
    },
    schedule: schedule,
    week: week,
    events: events,
    calendarEvents: calendarEvents,
    tasks: tasks,
    daily: daily,
    stats: {
      active: tasks.filter(function (task) {
        return task.status !== 'Готово' && task.status !== 'Отменено';
      }).length,
      high: tasks.filter(function (task) {
        return task.priority === 'Высокий' && task.status !== 'Готово';
      }).length,
      todayEvents: events.filter(function (event) {
        return event.date === isoDate;
      }).length
    },
    version: CONFIG.version,
    warnings: warnings,
    spreadsheetUrl: ss.getUrl(),
    syncedAt: formatDate_(new Date(), 'HH:mm:ss')
  };
}

function refreshCalendarAndGetDashboardData(date) { return getDashboardData(date); }

function getContentPlanData() {
  const source = SpreadsheetApp.openById(CONFIG.contentPlan.spreadsheetId);
  const sheet = source.getSheetByName(CONFIG.contentPlan.sheetName);
  if (!sheet) throw new Error('В таблице «Контент план Бадьян» не найден лист «Лист1».');

  const lastRow = sheet.getLastRow();
  const rowCount = Math.max(lastRow - 1, 0);
  const values = rowCount ? sheet.getRange(2, 1, rowCount, 3).getDisplayValues() : [];
  const richReels = rowCount ? sheet.getRange(2, 2, rowCount, 1).getRichTextValues() : [];
  const currentYear = Number(formatDate_(new Date(), 'yyyy'));
  const items = values.map(function (row, index) {
    const rawDate = String(row[0] || '').trim();
    const reel = String(row[1] || '').trim();
    const text = String(row[2] || '').trim();
    const richText = richReels[index] && richReels[index][0];
    const richLink = richText && richText.getLinkUrl ? richText.getLinkUrl() : '';
    const link = richLink || firstUrl_(reel);
    const published = rawDate.indexOf('✅') > -1;
    const dateLabel = rawDate.replace(/✅/g, '').trim();

    return {
      row: index + 2,
      date: dateLabel,
      isoDate: parseContentPlanDate_(dateLabel, currentYear),
      reel: reel,
      text: text,
      link: link,
      published: published,
      status: published ? 'Опубликовано' : 'В плане'
    };
  }).filter(function (item) {
    return item.date || item.reel || item.text;
  });

  return {
    ready: true,
    items: items,
    stats: {
      total: items.length,
      published: items.filter(function (item) { return item.published; }).length,
      planned: items.filter(function (item) { return !item.published; }).length,
      withText: items.filter(function (item) { return Boolean(item.text); }).length
    },
    sourceTitle: source.getName(),
    spreadsheetUrl: source.getUrl(),
    syncedAt: formatDate_(new Date(), 'HH:mm:ss')
  };
}

function parseContentPlanDate_(value, fallbackYear) {
  const match = String(value || '').trim().match(/^(\d{1,2})[.,\/-](\d{1,2})(?:[.,\/-](\d{2,4}))?$/);
  if (!match) return '';
  const day = Number(match[1]);
  const month = Number(match[2]);
  let year = match[3] ? Number(match[3]) : Number(fallbackYear);
  if (year < 100) year += 2000;
  const date = new Date(year, month - 1, day, 12, 0, 0);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return '';
  return formatDate_(date, 'yyyy-MM-dd');
}

function firstUrl_(value) {
  const match = String(value || '').match(/https?:\/\/[^\s]+/i);
  return match ? match[0].replace(/[),.;]+$/g, '') : '';
}

function shortDayName_(date) {
  const dayIndex = isoDayIndex_(date);
  return ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'][dayIndex - 1] || '';
}

function getCalendarEvents_(ss) {
  const sheet = ss.getSheetByName(CONFIG.sheets.calendar);
  if (!sheet || sheet.getLastRow() < 2) return [];

  const rowCount = sheet.getLastRow() - 1;
  const values = sheet.getRange(2, 1, rowCount, 12).getDisplayValues();
  let links = [];
  try {
    links = sheet.getRange(2, 9, rowCount, 1).getRichTextValues();
  } catch (error) {
    links = [];
  }

  return values.map(function (row, index) {
    const richText = links[index] && links[index][0];
    return {
      date: String(row[0] || ''),
      day: String(row[1] || ''),
      start: String(row[2] || ''),
      end: String(row[3] || ''),
      title: String(row[4] || ''),
      type: String(row[5] || ''),
      location: String(row[6] || ''),
      busy: String(row[7] || ''),
      url: richText && richText.getLinkUrl() ? richText.getLinkUrl() : '',
      eventId: String(row[9] || ''),
      updatedAt: String(row[10] || ''),
      source: String(row[11] || '')
    };
  }).filter(function (event) {
    return event.date && event.title;
  }).sort(function (a, b) {
    return (a.date + ' ' + a.start).localeCompare(b.date + ' ' + b.start, 'ru');
  });
}

function getUpcomingCalendarEvents_(events) {
  const startIso = formatDate_(new Date(), 'yyyy-MM-dd');
  const start = normalizeDate_(startIso);
  const end = new Date(start);
  end.setDate(end.getDate() + 30);
  const endIso = formatDate_(end, 'yyyy-MM-dd');

  return (events || []).filter(function (event) {
    return /^\d{4}-\d{2}-\d{2}$/.test(event.date) &&
      event.date >= startIso &&
      event.date < endIso;
  }).sort(function (a, b) {
    return (a.date + ' ' + a.start).localeCompare(b.date + ' ' + b.start, 'ru');
  });
}

function saveDaily(payload) {
  payload = payload || {};
  const lock = LockService.getDocumentLock();
  lock.waitLock(15000);

  try {
    const ss = getSpreadsheet_();
    ensureJournal_(ss);
    const sheet = ss.getSheetByName(CONFIG.sheets.journal);
    const isoDate = normalizeIsoDate_(payload.date);
    const row = findJournalRow_(sheet, isoDate) || Math.max(sheet.getLastRow() + 1, 2);
    const values = [[
      isoDate,
      cleanText_(payload.result1),
      cleanText_(payload.result2),
      cleanText_(payload.result3),
      cleanText_(payload.quickNotes),
      cleanText_(payload.morningRisk),
      cleanText_(payload.done),
      cleanText_(payload.newAtEvening),
      cleanText_(payload.tomorrowResults),
      cleanText_(payload.timePlan),
      formatDate_(new Date(), 'yyyy-MM-dd HH:mm:ss'),
      'Веб-дашборд'
    ]];

    sheet.getRange(row, 1, 1, values[0].length).setValues(values);
    sheet.getRange(row, 1, 1, values[0].length)
      .setVerticalAlignment('top')
      .setWrap(true);
    sheet.getRange(row, 1).setNumberFormat('@');
    SpreadsheetApp.flush();

    return {
      ok: true,
      date: isoDate,
      updatedAt: formatDate_(new Date(), 'HH:mm:ss')
    };
  } finally {
    lock.releaseLock();
  }
}

function saveTask(payload) {
  payload = payload || {};
  const lock = LockService.getDocumentLock();
  lock.waitLock(15000);

  try {
    const ss = getSpreadsheet_();
    const sheet = ss.getSheetByName(CONFIG.sheets.tasks);
    if (!sheet) throw new Error('Вкладка «Задачи» не найдена.');

    const title = cleanText_(payload.title, 1000);
    if (!title) throw new Error('Укажите название задачи.');

    const rowValues = [[
      title,
      cleanText_(payload.direction, 500) || 'Без направления',
      allowedValue_(payload.priority, ['Высокий', 'Средний', 'Низкий'], 'Средний'),
      allowedValue_(payload.status, ['Не начато', 'В работе', 'Готово', 'Отложено'], 'Не начато'),
      cleanText_(payload.due, 100),
      cleanText_(payload.nextAction, 1500),
      cleanText_(payload.source, 200) || 'Веб-дашборд'
    ]];

    let row = Number(payload.row);
    if (!Number.isInteger(row) || row < CONFIG.taskStartRow || row > sheet.getLastRow()) {
      row = findEmptyTaskRow_(sheet);
    }

    sheet.getRange(row, 1, 1, rowValues[0].length).setValues(rowValues);
    sheet.getRange(row, 1, 1, rowValues[0].length)
      .setVerticalAlignment('middle')
      .setWrap(true);
    SpreadsheetApp.flush();

    return {
      ok: true,
      task: taskFromRow_(rowValues[0], row),
      updatedAt: formatDate_(new Date(), 'HH:mm:ss')
    };
  } finally {
    lock.releaseLock();
  }
}

function setTaskStatus(row, status) {
  const lock = LockService.getDocumentLock();
  lock.waitLock(15000);

  try {
    const ss = getSpreadsheet_();
    const sheet = ss.getSheetByName(CONFIG.sheets.tasks);
    row = Number(row);
    if (!Number.isInteger(row) || row < CONFIG.taskStartRow || row > sheet.getLastRow()) {
      throw new Error('Задача не найдена.');
    }

    status = allowedValue_(status, ['Не начато', 'В работе', 'Готово', 'Отложено'], 'Не начато');
    sheet.getRange(row, 4).setValue(status);
    SpreadsheetApp.flush();
    return {ok: true, row: row, status: status, updatedAt: formatDate_(new Date(), 'HH:mm:ss')};
  } finally {
    lock.releaseLock();
  }
}

function getAiLabData() {
  return getAiLabData_(getSpreadsheet_());
}

function saveProjectEvent(payload) {
  payload = payload || {};
  const lock = LockService.getDocumentLock();
  lock.waitLock(15000);

  try {
    const ss = getSpreadsheet_();
    const projectSheet = ss.getSheetByName(CONFIG.sheets.aiProjects);
    const eventSheet = ss.getSheetByName(CONFIG.sheets.aiEvents);
    if (!projectSheet || !eventSheet) {
      throw new Error('Вкладки «ИИ‑лаборатории» не найдены.');
    }

    const projectId = cleanText_(payload.projectId, 100);
    const eventType = allowedValue_(payload.type, [
      'progress', 'blocker', 'pause', 'close'
    ], '');
    const defaults = {
      progress: 'Продвижение отмечено',
      pause: 'Проект приостановлен',
      close: 'Проект закрыт'
    };
    const comment = cleanText_(payload.comment, 3000) || defaults[eventType] || '';
    if (!projectId || !eventType || (eventType === 'blocker' && !comment)) {
      throw new Error('Не хватает данных для записи события.');
    }

    const row = findProjectRow_(projectSheet, projectId);
    if (!row) throw new Error('Проект не найден.');
    const values = projectSheet.getRange(row, 1, 1, 18).getDisplayValues()[0];
    const beforeStage = String(values[4] || '');
    const beforeState = String(values[5] || '');
    let afterStage = beforeStage;
    let points = 0;
    const now = new Date();
    const date = formatDate_(now, 'yyyy-MM-dd');
    const stamp = formatDate_(now, 'yyyy-MM-dd HH:mm:ss');
    const updates = [];
    function queueUpdate(column, value) {
      updates.push({column: column, value: value});
    }

    if (eventType === 'progress') {
      if (beforeState === 'Приостановлен' || beforeState === 'Закрыт') {
        queueUpdate(6, 'Активен');
      }
      queueUpdate(9, comment);
      queueUpdate(10, date);
      queueUpdate(7, 'В движении');
      queueUpdate(12, 'нет');
      points = 5;
    } else if (eventType === 'blocker') {
      queueUpdate(7, 'Заблокирован');
      queueUpdate(12, comment);
    } else if (eventType === 'pause') {
      queueUpdate(6, 'Приостановлен');
      queueUpdate(7, 'Неактуален');
    } else if (eventType === 'close') {
      queueUpdate(6, 'Закрыт');
      queueUpdate(7, 'Неактуален');
      queueUpdate(9, comment);
      queueUpdate(10, date);
      points = 10;
    }

    queueUpdate(18, stamp);
    const eventId = Utilities.getUuid();
    eventSheet.appendRow([
      eventId, projectId, stamp, eventType, comment, '',
      beforeStage, afterStage, points, 'Веб‑дашборд', stamp
    ]);
    eventSheet.getRange(eventSheet.getLastRow(), 1, 1, 11)
      .setVerticalAlignment('top')
      .setWrap(true);
    updates.forEach(function (update) {
      projectSheet.getRange(row, update.column).setValue(update.value);
    });
    SpreadsheetApp.flush();

    const verified = getAiLabData_(ss);
    const projectVerified = verified.projects.some(function (project) {
      return project.id === projectId && project.updatedAt === stamp;
    });
    const eventVerified = verified.events.some(function (event) {
      return event.id === eventId;
    });
    if (!projectVerified || !eventVerified) {
      throw new Error('Запись создана, но повторная проверка не сошлась. Откройте журнал событий.');
    }

    return {
      ok: true,
      data: verified,
      eventId: eventId,
      points: points,
      updatedAt: formatDate_(now, 'HH:mm:ss')
    };
  } finally {
    lock.releaseLock();
  }
}

function getAiLabData_(ss) {
  const projectSheet = ss.getSheetByName(CONFIG.sheets.aiProjects);
  const eventSheet = ss.getSheetByName(CONFIG.sheets.aiEvents);
  const achievementSheet = ss.getSheetByName(CONFIG.sheets.achievements);
  if (!projectSheet || !eventSheet || !achievementSheet) {
    return {
      ready: false,
      projects: [],
      events: [],
      achievements: [],
      stats: {activeFronts: 0, blocked: 0, points: 0, activeProjects: 0},
      rhythm: [],
      message: 'Сначала создайте вкладки данных «ИИ‑лаборатории».',
      syncedAt: formatDate_(new Date(), 'HH:mm:ss'),
      spreadsheetUrl: ss.getUrl()
    };
  }

  const projectValues = projectSheet.getLastRow() < 2 ? [] :
    projectSheet.getRange(2, 1, projectSheet.getLastRow() - 1, 18).getDisplayValues();
  const projects = projectValues.map(function (row) {
    return {
      id: String(row[0] || ''),
      name: String(row[1] || ''),
      type: String(row[2] || ''),
      outcome: String(row[3] || ''),
      stage: String(row[4] || ''),
      state: String(row[5] || ''),
      health: String(row[6] || ''),
      priority: Number(row[7] || 99),
      lastResult: String(row[8] || ''),
      lastResultDate: String(row[9] || ''),
      nextAction: String(row[10] || ''),
      blocker: String(row[11] || ''),
      milestone: String(row[12] || ''),
      milestoneDate: String(row[13] || ''),
      links: String(row[14] || ''),
      excluded: /^(да|true|1)$/i.test(String(row[15] || '')),
      order: Number(row[16] || 99),
      updatedAt: String(row[17] || '')
    };
  }).filter(function (project) {
    return project.id && project.name;
  }).sort(function (a, b) {
    return a.order - b.order;
  });

  const eventValues = eventSheet.getLastRow() < 2 ? [] :
    eventSheet.getRange(2, 1, eventSheet.getLastRow() - 1, 11).getDisplayValues();
  const events = eventValues.map(function (row) {
    return {
      id: String(row[0] || ''),
      projectId: String(row[1] || ''),
      time: String(row[2] || ''),
      type: String(row[3] || ''),
      comment: String(row[4] || ''),
      evidence: String(row[5] || ''),
      beforeStage: String(row[6] || ''),
      afterStage: String(row[7] || ''),
      points: Number(row[8] || 0),
      source: String(row[9] || ''),
      createdAt: String(row[10] || '')
    };
  }).filter(function (event) {
    return event.id && event.projectId;
  }).sort(function (a, b) {
    return b.time.localeCompare(a.time, 'ru');
  });

  const achievementValues = achievementSheet.getLastRow() < 2 ? [] :
    achievementSheet.getRange(2, 1, achievementSheet.getLastRow() - 1, 9).getDisplayValues();
  const achievements = achievementValues.map(function (row) {
    return {
      id: String(row[0] || ''),
      code: String(row[1] || ''),
      name: String(row[2] || ''),
      description: String(row[3] || ''),
      rule: String(row[4] || ''),
      unlockedAt: String(row[5] || ''),
      projectId: String(row[6] || ''),
      eventId: String(row[7] || ''),
      visibility: String(row[8] || '')
    };
  }).filter(function (achievement) {
    return achievement.id;
  });

  const stats = {
    activeFronts: projects.filter(function (project) {
      return project.state === 'Активен' && !project.excluded;
    }).length,
    blocked: projects.filter(function (project) {
      return project.health === 'Заблокирован';
    }).length,
    points: events.reduce(function (sum, event) {
      return sum + event.points;
    }, 0),
    activeProjects: projects.filter(function (project) {
      return ['Активен', 'Работает'].indexOf(project.state) > -1;
    }).length
  };

  const rhythm = buildRhythm_(events);
  let message = 'Документ создан. Теперь осторожно: его ещё придётся реализовать.';
  if (stats.activeFronts > 3) {
    message = 'Три активных проекта. Четвёртому отказано в госпитализации.';
  } else if (stats.blocked) {
    message = 'Есть блокер. Пора собирать консилиум, а не новую вкладку.';
  } else if (events.some(function (event) { return event.points > 0; })) {
    message = 'Движение зафиксировано. Бумажная работа внезапно стала продуктом.';
  }

  return {
    ready: true,
    stages: aiStages_(),
    projects: projects,
    events: events.slice(0, 30),
    achievements: achievements,
    stats: stats,
    rhythm: rhythm,
    message: message,
    syncedAt: formatDate_(new Date(), 'HH:mm:ss'),
    spreadsheetUrl: ss.getUrl()
  };
}

function findProjectRow_(sheet, projectId) {
  if (!sheet || sheet.getLastRow() < 2) return 0;
  const ids = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getDisplayValues();
  for (let index = 0; index < ids.length; index += 1) {
    if (String(ids[index][0] || '') === projectId) return index + 2;
  }
  return 0;
}

function aiStages_() {
  return ['Идея', 'Концепция', 'Архитектура', 'Прототип', 'Реализация',
    'Проверка', 'Пилот', 'Работает', 'Развитие'];
}

function buildRhythm_(events) {
  const result = [];
  const now = new Date();
  for (let offset = 11; offset >= 0; offset -= 1) {
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);
    end.setDate(end.getDate() - offset * 7);
    const start = new Date(end);
    start.setDate(start.getDate() - 6);
    start.setHours(0, 0, 0, 0);
    const count = events.filter(function (event) {
      if (!event.time || event.type === 'реестр_создан') return false;
      const parsed = new Date(event.time.replace(' ', 'T') + '+03:00');
      return !isNaN(parsed.getTime()) && parsed >= start && parsed <= end;
    }).length;
    result.push({
      label: formatDate_(start, 'dd.MM') + '–' + formatDate_(end, 'dd.MM'),
      count: count
    });
  }
  return result;
}

function getSpreadsheet_() {
  return SpreadsheetApp.openById(CONFIG.spreadsheetId);
}

function safelyRead_(label, reader, fallback, warnings) {
  try {
    return reader();
  } catch (error) {
    warnings.push(label + ': ' + errorMessage_(error));
    return fallback;
  }
}

function errorMessage_(error) {
  if (!error) return 'неизвестная ошибка';
  return String(error.message || error).replace(/^Exception:\s*/i, '').trim();
}

function isoDayIndex_(date) {
  const day = date.getDay();
  return day === 0 ? 7 : day;
}

function getTasks_(ss) {
  const sheet = ss.getSheetByName(CONFIG.sheets.tasks);
  if (!sheet || sheet.getLastRow() < CONFIG.taskStartRow) return [];

  const values = sheet
    .getRange(CONFIG.taskStartRow, 1, sheet.getLastRow() - CONFIG.taskStartRow + 1, 7)
    .getDisplayValues();

  return values.map(function (row, index) {
    return taskFromRow_(row, CONFIG.taskStartRow + index);
  }).filter(function (task) {
    return task.title && (task.direction || task.priority || task.status || task.nextAction || task.source);
  });
}

function taskFromRow_(row, sheetRow) {
  return {
    row: sheetRow,
    title: String(row[0] || ''),
    direction: String(row[1] || ''),
    priority: String(row[2] || 'Средний'),
    status: String(row[3] || 'Не начато'),
    due: String(row[4] || ''),
    nextAction: String(row[5] || ''),
    source: String(row[6] || '')
  };
}

function findEmptyTaskRow_(sheet) {
  const lastRow = Math.max(sheet.getLastRow(), CONFIG.taskStartRow);
  const titles = sheet.getRange(CONFIG.taskStartRow, 1, lastRow - CONFIG.taskStartRow + 1, 1).getDisplayValues();
  for (let i = 0; i < titles.length; i += 1) {
    const candidate = CONFIG.taskStartRow + i;
    if (!titles[i][0] && !sheet.getRange(candidate, 1, 1, 7).isPartOfMerge()) return candidate;
  }
  for (let i = 0; i < titles.length; i += 1) {
    const candidate = CONFIG.taskStartRow + i;
    if (String(titles[i][0] || '').indexOf('Сейчас показаны') === 0) {
      sheet.insertRowBefore(candidate);
      if (candidate > CONFIG.taskStartRow) {
        sheet.getRange(candidate - 1, 1, 1, 7).copyTo(
          sheet.getRange(candidate, 1, 1, 7),
          SpreadsheetApp.CopyPasteType.PASTE_FORMAT,
          false
        );
      }
      return candidate;
    }
  }
  return lastRow + 1;
}

function getDaySchedule_(ss, dayIndex) {
  const sheet = ss.getSheetByName(CONFIG.sheets.settings);
  if (!sheet) return [];
  const row = sheet.getRange(4 + dayIndex, 3, 1, 8).getDisplayValues()[0];
  const blocks = [];
  for (let i = 0; i < row.length; i += 2) {
    if (row[i] || row[i + 1]) {
      blocks.push({time: row[i] || '', title: row[i + 1] || ''});
    }
  }
  return blocks;
}

function getWeekSchedule_(ss) {
  const sheet = ss.getSheetByName(CONFIG.sheets.settings);
  if (!sheet) return [];
  const rows = sheet.getRange(5, 2, 7, 9).getDisplayValues();
  return rows.map(function (row, index) {
    const blocks = [];
    for (let i = 1; i < row.length; i += 2) {
      if (row[i] || row[i + 1]) blocks.push({time: row[i] || '', title: row[i + 1] || ''});
    }
    return {dayIndex: index + 1, day: row[0] || dayNames_()[index], blocks: blocks};
  });
}

function ensureJournal_(ss) {
  let sheet = ss.getSheetByName(CONFIG.sheets.journal);
  if (sheet) return sheet;

  sheet = ss.insertSheet(CONFIG.sheets.journal);
  const headers = [[
    'Дата', 'Результат 1', 'Результат 2', 'Результат 3', 'Быстрые заметки',
    'Утренний риск', 'Что выполнено', 'Новое к вечеру',
    'Три результата завтра', 'План по времени', 'Обновлено', 'Источник'
  ]];
  sheet.getRange(1, 1, 1, headers[0].length).setValues(headers);
  sheet.setFrozenRows(1);
  return sheet;
}

function getDaily_(ss, isoDate) {
  const empty = emptyDaily_(isoDate);

  const sheet = ss.getSheetByName(CONFIG.sheets.journal);
  const row = findJournalRow_(sheet, isoDate);
  if (!row) return empty;
  const values = sheet.getRange(row, 1, 1, 12).getDisplayValues()[0];
  return {
    date: isoDate,
    result1: values[1] || '',
    result2: values[2] || '',
    result3: values[3] || '',
    quickNotes: values[4] || '',
    morningRisk: values[5] || '',
    done: values[6] || '',
    newAtEvening: values[7] || '',
    tomorrowResults: values[8] || '',
    timePlan: values[9] || '',
    updatedAt: values[10] || ''
  };
}

function emptyDaily_(isoDate) {
  return {
    date: isoDate,
    result1: '',
    result2: '',
    result3: '',
    quickNotes: '',
    morningRisk: '',
    done: '',
    newAtEvening: '',
    tomorrowResults: '',
    timePlan: '',
    updatedAt: ''
  };
}

function findJournalRow_(sheet, isoDate) {
  if (!sheet || sheet.getLastRow() < 2) return 0;
  const dates = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getDisplayValues();
  for (let i = 0; i < dates.length; i += 1) {
    if (normalizeDisplayedDate_(dates[i][0]) === isoDate) return i + 2;
  }
  return 0;
}

function normalizeDisplayedDate_(value) {
  value = String(value || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const match = value.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (!match) return value;
  return match[3] + '-' + ('0' + match[2]).slice(-2) + '-' + ('0' + match[1]).slice(-2);
}

function normalizeDate_(isoDate) {
  if (!isoDate) return new Date();
  const normalized = normalizeIsoDate_(isoDate);
  const parts = normalized.split('-').map(Number);
  return new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0);
}

function normalizeIsoDate_(value) {
  value = String(value || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error('Некорректная дата.');
  }
  return value;
}

function cleanText_(value, maxLength) {
  maxLength = maxLength || CONFIG.maxTextLength;
  return String(value == null ? '' : value).trim().slice(0, maxLength);
}

function allowedValue_(value, allowed, fallback) {
  value = String(value || '');
  return allowed.indexOf(value) > -1 ? value : fallback;
}

function formatDate_(date, pattern) {
  return Utilities.formatDate(date, CONFIG.timeZone, pattern);
}

function russianDate_(date) {
  const dayIndex = isoDayIndex_(date);
  const monthIndex = Number(formatDate_(date, 'M')) - 1;
  const months = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
    'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  return dayNames_()[dayIndex - 1] + ', ' + Number(formatDate_(date, 'd')) +
    ' ' + months[monthIndex] + ' ' + formatDate_(date, 'yyyy');
}

function dayNames_() {
  return ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'];
}

