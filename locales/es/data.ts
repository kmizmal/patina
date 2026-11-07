// es locale resource. Pure data only.
export const MESSAGES = {
  "data.activityHeatmap": "Mapa de calor de actividad",
  "data.activityHeatmapHint": "Intensidad de actividad diaria",
  "data.activityTrend": "Tendencia de actividad",
  "data.allTime": "Todo el período",
  "data.appHeatmap": "Mapa de calor de apps",
  "data.applyRange": "Aplicar",
  "data.appSearchPlaceholder": "Buscar apps",
  "data.appTrend": "Tendencias de apps",
  "data.appTrendActiveDays": "Días activos",
  "data.appTrendAppList": "Lista de apps",
  "data.appTrendAverage": "Prom. diario",
  "data.appTrendEmpty": "No hay datos de apps en este intervalo",
  "data.appTrendNoMatch": "No hay apps coincidentes",
  "data.appTrendPeakDay": "Día de mayor actividad",
  "data.appTrendTotal": "Total",
  "data.appTrendUsage": "Tiempo en apps",
  "data.categoryHeatmap": "Mapa de calor de categorías",
  "data.categoryInteractionHint": "Enter para seleccionar · Ctrl para varias",
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
            "one": "app",
            "other": "apps",
            "many": "apps"
          }
        },
        ""
      ]
    }
  },
  "data.categorySearchPlaceholder": "Buscar categorías",
  "data.categoryTrend": "Tendencias de categorías",
  "data.categoryTrendCategoryList": "Lista de categorías de apps",
  "data.categoryTrendEmpty": "No hay datos de categorías en este intervalo",
  "data.categoryTrendNoMatch": "No hay categorías coincidentes",
  "data.customDayCount": {
    "$type": "message",
    "body": {
      "$op": "if",
      "when": {
        "$op": "eq",
        "left": {
          "$op": "arg",
          "name": "days"
        },
        "right": 1
      },
      "then": {
        "$op": "concat",
        "parts": [
          {
            "$op": "arg",
            "name": "days"
          },
          " día"
        ]
      },
      "else": {
        "$op": "concat",
        "parts": [
          {
            "$op": "arg",
            "name": "days"
          },
          " días"
        ]
      }
    }
  },
  "data.dailyAverage": "Prom. diario",
  "data.destinationApp": "Apps",
  "data.destinationCategory": "Categorías",
  "data.destinationMode": "Seleccionar tipo de actividad",
  "data.destinationWeb": "Web",
  "data.duration": "Duración",
  "data.heatmapDaily": "Diario",
  "data.heatmapError": "El mapa de calor no está disponible temporalmente",
  "data.keyboardHeatmap": "Mapa de calor del teclado",
  "data.keyboardDisabled": "La grabación del teclado está desactivada. Activa «Registrar actividad del teclado» para ver el uso de las teclas.",
  "data.keyboardError": "Los datos del teclado no están disponibles temporalmente",
  "data.keyboardRetry": "Reintentar",
  "data.keyboardLoading": "Leyendo datos del teclado…",
  "data.keyboardEmpty": "Todavía no hay actividad del teclado en este rango",
  "data.keyboardLayoutMismatch": "Ninguna de las teclas registradas pertenece a esta distribución. Prueba con otra.",
  "data.keyboardTopKeys": "Teclas más pulsadas",
  "data.keyboardTopCombos": "Combinaciones más usadas",
  "data.keyboardNoCombos": "No hay combinaciones de teclas en este rango",
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
      " pulsaciones · ",
      {
        "$op": "arg",
        "name": "share"
      },
      " del total"
    ]
  }
  },
  "accessibility.data.keyboardHeatmap": {
    "$type": "message",
    "body": {
    "$op": "concat",
    "parts": [
      "Mapa de calor del teclado: ",
      {
        "$op": "arg",
        "name": "count"
      },
      " pulsaciones"
    ]
  }
  },
  "data.keyboardLayouts.60%": "60%",
  "data.keyboardLayouts.75%": "75%",
  "data.keyboardLayouts.TKL": "TKL",
  "data.keyboardLayouts.Full": "Tamaño completo",
  "data.keyboardLayouts.Laptop": "Portátil",
  "accessibility.data.keyboardLayoutFilter": "Elegir distribución del teclado",
  "data.keyboardRegions.letters": "Letras",
  "data.keyboardRegions.digits": "Dígitos",
  "data.keyboardRegions.symbols": "Símbolos",
  "data.keyboardRegions.modifiers": "Modificadores",
  "data.keyboardRegions.editing": "Teclas de edición",
  "data.keyboardRegions.function": "Teclas de función",
  "data.keyboardRegions.navigation": "Navegación",
  "data.keyboardRegions.numpad": "Teclado numérico",
  "data.heatmapWeekly": "Semanal",
  "data.interactionHint": "Doble clic para detalles · Ctrl para seleccionar",
  "data.monthlyAverage": "Prom. mensual",
  "data.notStarted": "Sin iniciar",
  "data.pastSevenDays": "Últimos 7 días",
  "data.pastThirtyDays": "Últimos 30 días",
  "data.pickDate": "Seleccionar fecha",
  "data.pickEndDate": "Fecha final",
  "data.pickerModes.custom": "Personalizado",
  "data.pickerModes.month": "Mes",
  "data.pickerModes.week": "Semana",
  "data.pickerModes.year": "Año",
  "data.pickStartDate": "Fecha inicial",
  "data.rangeAverageHint": {
    "$type": "message",
    "body": {
      "$op": "concat",
      "parts": [
        "Basado en ",
        {
          "$op": "arg",
          "name": "rangeLabel"
        },
        ""
      ]
    }
  },
  "data.rangePickerTitle": "Seleccionar intervalo",
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
        " en total"
      ]
    }
  },
  "data.recentYear": "Último año",
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
            "one": "elemento",
            "other": "elementos",
            "many": "elementos"
          }
        },
        ""
      ]
    }
  },
  "data.selectionLastItem": "Mantén al menos 1 elemento seleccionado",
  "data.selectionLimitReached": "Compara hasta 7 elementos",
  "data.shortRangeHint": "El intervalo actual es inferior a 7 días.",
  "data.title": "Datos",
  "data.webHeatmap": "Mapa de calor web",
  "data.webNoActivity": "No hay actividad web registrada",
  "data.webNotRecorded": "Sin registrar",
  "data.webSearchPlaceholder": "Buscar sitios web",
  "data.webTrend": "Tendencias web",
  "data.webTrendDomainList": "Lista de sitios web",
  "data.webTrendEmpty": "No hay registros web en este intervalo",
  "data.webTrendError": "El análisis web no está disponible temporalmente",
  "data.webTrendNoMatch": "No hay sitios web coincidentes",
  "data.webTrendRefreshError": "No se pudo actualizar. Se muestra el último resultado.",
  "data.webTrendRetry": "Reintentar",
  "data.webTrendTotal": "Total",
  "data.webTrendUsage": "Tiempo web registrado",
  "data.weekLabel": {
    "$type": "message",
    "body": {
      "$op": "concat",
      "parts": [
        "Semana ",
        {
          "$op": "arg",
          "name": "week"
        },
        ""
      ]
    }
  },
  "data.weeklyTotal": "Total de 7 días",
  "data.yearLabel": {
    "$type": "message",
    "body": {
      "$op": "arg",
      "name": "year"
    }
  },
  "data.yearlyAverage": "Prom. mensual",
  "data.yearlyAverageHint": "Basado en los meses del último año"
} as const;
