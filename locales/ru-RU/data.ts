// ru-RU locale resource. Pure data only.
export const MESSAGES = {
  "data.activityHeatmap": "Тепловая карта активности",
  "data.activityHeatmapHint": "Интенсивность активности по дням",
  "data.activityTrend": "Динамика активности",
  "data.allTime": "За всё время",
  "data.appHeatmap": "Тепловая карта прил.",
  "data.applyRange": "Применить",
  "data.appSearchPlaceholder": "Поиск прил.",
  "data.appTrend": "Динамика прил.",
  "data.appTrendActiveDays": "Активные дни",
  "data.appTrendAppList": "Список прил.",
  "data.appTrendAverage": "В среднем за день",
  "data.appTrendEmpty": "Нет данных приложений за этот период",
  "data.appTrendNoMatch": "Подходящих приложений нет",
  "data.appTrendPeakDay": "Самый активный день",
  "data.appTrendTotal": "Всего",
  "data.appTrendUsage": "Время в прил.",
  "data.categoryHeatmap": "Тепловая карта категорий",
  "data.categoryInteractionHint": "Enter — выбор · Ctrl — несколько",
  "data.categoryMemberCount": {
    "$type": "message",
    "body": {
      "$op": "concat",
      "parts": [
        "",
        {
          "$op": "arg",
          "name": "count"
        },
        " ",
        {
          "$op": "plural",
          "arg": "count",
          "cases": {
              "one": "прил.",
              "other": "прил.",
              "many": "прил.",
              "few": "прил."
          }
        },
        ""
      ]
    }
  },
  "data.categorySearchPlaceholder": "Поиск категорий",
  "data.categoryTrend": "Динамика категорий",
  "data.categoryTrendCategoryList": "Список категорий прил.",
  "data.categoryTrendEmpty": "Нет данных категорий за этот период",
  "data.categoryTrendNoMatch": "Подходящих категорий нет",
  "data.customDayCount": {
    "$type": "message",
    "body": {
      "$op": "concat",
      "parts": [
        "",
        {
          "$op": "arg",
          "name": "days"
        },
        " дн."
      ]
    }
  },
  "data.dailyAverage": "В среднем за день",
  "data.destinationApp": "Прил.",
  "data.destinationCategory": "Категории",
  "data.destinationMode": "Выбрать тип активности",
  "data.destinationWeb": "Сайты",
  "data.duration": "Длительность",
  "data.heatmapDaily": "По дням",
  "data.heatmapError": "Тепловая карта временно недоступна",
  "data.keyboardHeatmap": "Тепловая карта клавиатуры",
  "data.keyboardDisabled": "Запись клавиатуры выключена. Включите «Записывать активность клавиатуры», чтобы увидеть распределение нажатий.",
  "data.keyboardEmpty": "В этом диапазоне пока нет активности клавиатуры",
  "data.keyboardLayoutMismatch": "Ни одна из записанных клавиш не относится к этой раскладке. Попробуйте другую.",
  "data.keyboardDistribution": "Распределение клавиш",
  "data.keyboardTopKeys": "Самые частые клавиши",
  "data.keyboardTopCombos": "Самые частые сочетания",
  "data.keyboardNoCombos": "В этом диапазоне нет сочетаний клавиш",
  "data.keyboardKeyTooltip": {
    "$type": "message",
    "body": {
    "$op": "concat",
    "parts": [
      "",
      {
        "$op": "arg",
        "name": "label"
      },
      " · ",
      {
        "$op": "arg",
        "name": "count"
      },
      " нажатий · ",
      {
        "$op": "arg",
        "name": "share"
      },
      " от всех"
    ]
  }
  },
  "accessibility.data.keyboardHeatmap": {
    "$type": "message",
    "body": {
    "$op": "concat",
    "parts": [
      "Тепловая карта клавиатуры: ",
      {
        "$op": "arg",
        "name": "count"
      },
      " нажатий"
    ]
  }
  },
  "data.keyboardLayouts.60%": "60%",
  "data.keyboardLayouts.75%": "75%",
  "data.keyboardLayouts.TKL": "TKL",
  "data.keyboardLayouts.Full": "Полный размер",
  "data.keyboardLayouts.Laptop": "Ноутбук",
  "accessibility.data.keyboardLayoutFilter": "Выбрать раскладку клавиатуры",
  "data.keyboardRegions.letters": "Буквы",
  "data.keyboardRegions.digits": "Цифры",
  "data.keyboardRegions.symbols": "Символы",
  "data.keyboardRegions.modifiers": "Модификаторы",
  "data.keyboardRegions.editing": "Редактирование",
  "data.keyboardRegions.function": "Функциональные клавиши",
  "data.keyboardRegions.navigation": "Навигация",
  "data.keyboardRegions.numpad": "Цифровой блок",
  "data.heatmapWeekly": "По неделям",
  "data.interactionHint": "Двойной щелчок — детали · Ctrl — выбор",
  "data.monthlyAverage": "В среднем за месяц",
  "data.notStarted": "Не запущено",
  "data.pastSevenDays": "Последние 7 дней",
  "data.pastThirtyDays": "Последние 30 дней",
  "data.pickDate": "Выбрать дату",
  "data.pickEndDate": "Дата окончания",
  "data.pickerModes.custom": "Свой вариант",
  "data.pickerModes.month": "Месяц",
  "data.pickerModes.week": "Неделя",
  "data.pickerModes.year": "Год",
  "data.pickStartDate": "Дата начала",
  "data.rangeAverageHint": {
    "$type": "message",
    "body": {
      "$op": "concat",
      "parts": [
        "Расчёт за период: ",
        {
          "$op": "arg",
          "name": "rangeLabel"
        },
        ""
      ]
    }
  },
  "data.rangePickerTitle": "Выбрать период",
  "data.rangeTotal": {
    "$type": "message",
    "body": {
      "$op": "concat",
      "parts": [
        "",
        {
          "$op": "arg",
          "name": "label"
        },
        " — всего"
      ]
    }
  },
  "data.recentYear": "Последний год",
  "data.selectedObjectCount": {
    "$type": "message",
    "body": {
      "$op": "concat",
      "parts": [
        "",
        {
          "$op": "arg",
          "name": "count"
        },
        " ",
        {
          "$op": "plural",
          "arg": "count",
          "cases": {
            "one": "объект",
            "other": "объекта",
            "many": "объектов",
            "few": "объекта"
          }
        },
        ""
      ]
    }
  },
  "data.selectionLastItem": "Оставьте выбранным хотя бы один объект",
  "data.selectionLimitReached": "Можно сравнить до 7 объектов",
  "data.shortRangeHint": "Выбранный период короче 7 дней.",
  "data.title": "Данные",
  "data.webHeatmap": "Тепловая карта сайтов",
  "data.webNoActivity": "Активность на сайтах не записана",
  "data.webNotRecorded": "Не записано",
  "data.webSearchPlaceholder": "Поиск сайтов",
  "data.webTrend": "Динамика сайтов",
  "data.webTrendDomainList": "Список сайтов",
  "data.webTrendEmpty": "Нет записей сайтов за этот период",
  "data.webTrendError": "Аналитика сайтов временно недоступна",
  "data.webTrendNoMatch": "Подходящих сайтов нет",
  "data.webTrendRefreshError": "Не удалось обновить. Показан предыдущий результат.",
  "data.webTrendRetry": "Повторить",
  "data.webTrendTotal": "Всего",
  "data.webTrendUsage": "Записанное время на сайтах",
  "data.weekLabel": {
    "$type": "message",
    "body": {
      "$op": "concat",
      "parts": [
        "Неделя ",
        {
          "$op": "arg",
          "name": "week"
        },
        ""
      ]
    }
  },
  "data.weeklyTotal": "Всего за 7 дней",
  "data.yearLabel": {
    "$type": "message",
    "body": {
      "$op": "arg",
      "name": "year"
    }
  },
  "data.yearlyAverage": "В среднем за месяц",
  "data.yearlyAverageHint": "Расчёт по месяцам за последний год"
} as const;
