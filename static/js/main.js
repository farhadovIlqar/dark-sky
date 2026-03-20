document.addEventListener("DOMContentLoaded", () => {
  const cityInput = document.getElementById("cityInput")
  const headerLocation = document.getElementById("headerLocation")
  const unitBtns = document.querySelectorAll(".unit-btn")
  const errorBox = document.getElementById("errorBox")
  const datePicker = document.getElementById("datePicker")

  const currentTimeEl = document.getElementById("currentTime")
  const currentTempEl = document.getElementById("currentTemp")
  const currentDescEl = document.getElementById("currentDesc")
  const currentFeelsLikeEl = document.getElementById("currentFeelsLike")

  const currentWindEl = document.getElementById("currentWind")
  const currentHumidityEl = document.getElementById("currentHumidity")
  const currentVisibilityEl = document.getElementById("currentVisibility")
  const currentPressureEl = document.getElementById("currentPressure")
  const currentUvEl = document.getElementById("currentUv")
  const currentDewEl = document.getElementById("currentDew")

  const dayTabsContainer = document.getElementById("dayTabsContainer")
  const hourlyContainer = document.getElementById("hourlyContainer")

  document
    .getElementById("hourlyPrevBtn")
    .addEventListener("click", () =>
      hourlyContainer.scrollBy({ left: -300, behavior: "smooth" })
    )
  document
    .getElementById("hourlyNextBtn")
    .addEventListener("click", () =>
      hourlyContainer.scrollBy({ left: 300, behavior: "smooth" })
    )

  let currentUnit = "metric"
  let globalLat = null
  let globalLon = null
  let globalCitySearch = null

  const loadingOverlay = document.getElementById("loadingOverlay")
  const appContainer   = document.querySelector(".app-container")

  const setLoading = (active) => {
    if (active) {
      loadingOverlay.classList.add("active")
      appContainer.classList.add("loading-active")
      loadingOverlay.setAttribute("aria-hidden", "false")
    } else {
      loadingOverlay.classList.remove("active")
      appContainer.classList.remove("loading-active")
      loadingOverlay.setAttribute("aria-hidden", "true")
    }
  }

  const today = new Date()
  const todayStr = today.toISOString().split("T")[0]
  datePicker.value = todayStr

  const maxDate = new Date()
  maxDate.setDate(maxDate.getDate() + 5)
  datePicker.max = maxDate.toISOString().split("T")[0]

  const minDate = new Date()
  minDate.setFullYear(minDate.getFullYear() - 1)
  datePicker.min = minDate.toISOString().split("T")[0]

  const showError = (message) => {
    errorBox.textContent = message
    errorBox.style.display = "block"
    setTimeout(() => {
      errorBox.style.display = "none"
    }, 5000)
  }

  const getIconSrc = (code) =>
    `https://openweathermap.org/img/wn/${code}@2x.png`

  const formatTime = (epoch, timezoneOffset = 0) => {
    const d = new Date((epoch + timezoneOffset) * 1000)
    return d.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
      timeZone: "UTC",
    })
  }

  const formatHourOnly = (epoch, timezoneOffset = 0) => {
    const d = new Date((epoch + timezoneOffset) * 1000)
    return d
      .toLocaleTimeString([], {
        hour: "numeric",
        hour12: true,
        timeZone: "UTC",
      })
      .toLowerCase()
  }

  const formatDayName = (epoch, timezoneOffset = 0) => {
    const d = new Date((epoch + timezoneOffset) * 1000)
    return d.toLocaleDateString([], {
      weekday: "short",
      day: "numeric",
      timeZone: "UTC",
    })
  }

  const setBackground = (weatherId) => {
    const card = document.getElementById("currentWeatherCard")
    if (weatherId >= 200 && weatherId < 300)
      card.style.backgroundImage =
        "url('https://images.unsplash.com/photo-1605727216801-e27ce1d0ce3c?w=500')"
    else if (weatherId >= 300 && weatherId < 600)
      card.style.backgroundImage =
        "url('https://images.unsplash.com/photo-1515694346937-94d85e41e6f0?w=500')"
    else if (weatherId >= 600 && weatherId < 700)
      card.style.backgroundImage =
        "url('https://images.unsplash.com/photo-1542601098-3adb3baeb1ec?w=500')"
    else if (weatherId === 800)
      card.style.backgroundImage =
        "url('https://images.unsplash.com/photo-1622396481328-9b1b78cdd9fd?w=500')"
    else
      card.style.backgroundImage =
        "url('https://images.unsplash.com/photo-1534088568595-a066f410cbda?w=500')"
  }

  const handleDateChange = () => {
    const selectedDateStr = datePicker.value
    if (!selectedDateStr) return

    // ── Client-side date range validation ─────────────────────────────────
    const selected = new Date(selectedDateStr + "T12:00:00")

    const pickerMin = new Date(datePicker.min + "T12:00:00")
    const pickerMax = new Date(datePicker.max + "T12:00:00")

    if (selected < pickerMin) {
      showError(
        `Date is too far in the past. Historical data is available up to 1 year back (${datePicker.min}).`
      )
      datePicker.value = todayStr
      return
    }
    if (selected > pickerMax) {
      showError(
        `Date is too far ahead. Forecast is available up to ${datePicker.max}.`
      )
      datePicker.value = todayStr
      return
    }

    const todayMidnight = new Date()
    todayMidnight.setHours(0, 0, 0, 0)

    const diffDays = Math.round(
      (selected - todayMidnight) / (1000 * 60 * 60 * 24)
    )

    const params = {}
    if (globalCitySearch) {
      params.city = globalCitySearch
    } else if (globalLat && globalLon) {
      params.lat = globalLat
      params.lon = globalLon
    } else {
      params.city = "London"
    }

    if (diffDays === 0) {
      fetchAllData(params)
    } else if (diffDays > 0) {
      fetchForecastForDay(params, selectedDateStr)
    } else {
      const unixTs = Math.floor(selected.getTime() / 1000)
      fetchHistoricalData(unixTs)
    }
  }

  const fetchAllData = async (params) => {
    setLoading(true)
    try {
      params.units = currentUnit
      const qs = new URLSearchParams(params).toString()

      const currRes = await fetch(`/api/weather/current?${qs}`)
      const currData = await currRes.json()

      if (!currRes.ok)
        throw new Error(currData.error || "Failed to fetch current weather.")

      globalLat = currData.coord.lat
      globalLon = currData.coord.lon
      globalCitySearch = null
      headerLocation.textContent = `${currData.name}, ${currData.sys.country}`

      renderCurrentWeather(currData)

      const forecastRes = await fetch(
        `/api/weather/forecast?lat=${globalLat}&lon=${globalLon}&units=${currentUnit}`
      )
      const forecastData = await forecastRes.json()

      if (!forecastRes.ok)
        throw new Error(forecastData.error || "Failed to fetch forecast.")

      renderForecast(forecastData.list, currData.timezone)
    } catch (e) {
      console.error(e)
      showError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const fetchForecastForDay = async (params, targetDateStr) => {
    setLoading(true)
    try {
      params.units = currentUnit
      const qs = new URLSearchParams(params).toString()

      const currRes = await fetch(`/api/weather/current?${qs}`)
      const currData = await currRes.json()

      if (!currRes.ok)
        throw new Error(currData.error || "Failed to fetch current weather.")

      globalLat = currData.coord.lat
      globalLon = currData.coord.lon
      globalCitySearch = null
      headerLocation.textContent = `${currData.name}, ${currData.sys.country}`

      const forecastRes = await fetch(
        `/api/weather/forecast?lat=${globalLat}&lon=${globalLon}&units=${currentUnit}`
      )
      const forecastData = await forecastRes.json()

      if (!forecastRes.ok)
        throw new Error(forecastData.error || "Failed to fetch forecast.")

      const tz = currData.timezone

      const dayEntries = forecastData.list.filter((item) => {
        const d = new Date((item.dt + tz) * 1000)
        return d.toISOString().split("T")[0] === targetDateStr
      })

      if (dayEntries.length > 0) {
        const midday = dayEntries[Math.floor(dayEntries.length / 2)]
        renderCurrentWeatherFromForecast(midday, tz, currData)
        renderHourly(dayEntries, tz)
      }

      renderForecastTabs(forecastData.list, tz, targetDateStr)
    } catch (e) {
      console.error(e)
      showError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const fetchHistoricalData = async (unixTimestamp) => {
    if (!globalLat || !globalLon) {
      showError("Please search for a city first before selecting a historical date.")
      return
    }
    setLoading(true)
    try {
      const res = await fetch(
        `/api/weather/historical?lat=${globalLat}&lon=${globalLon}&dt=${unixTimestamp}&units=${currentUnit}`
      )
      const data = await res.json()

      if (!res.ok) throw new Error(data.error || "Failed to fetch historical data.")

      const hourlyData = data.data || []
      if (hourlyData.length === 0) throw new Error("No historical data returned.")

      const snap = hourlyData[0]
      renderHistoricalWeather(snap)
      renderHourly(hourlyData.map(h => ({
        dt: h.dt,
        main: { temp: h.temp, feels_like: h.feels_like, humidity: h.humidity },
        weather: h.weather,
        wind: { speed: h.wind_speed },
        pop: 0
      })), 0)

      dayTabsContainer.innerHTML = `<span style="color: rgba(255,255,255,0.7); font-size: 0.9rem; padding: 5px 10px;">Historical view</span>`
    } catch (e) {
      console.error(e)
      showError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const renderCurrentWeather = (data) => {
    const tempUnit = currentUnit === "metric" ? "°C" : "°F"
    const speedUnit = currentUnit === "metric" ? "m/s" : "mph"

    currentTimeEl.textContent = formatTime(data.dt, data.timezone)
    currentTempEl.textContent = `${Math.round(data.main.temp)}°`
    currentDescEl.textContent = data.weather[0].description
    currentFeelsLikeEl.textContent = `${Math.round(data.main.feels_like)}°`

    currentWindEl.textContent = `${data.wind.speed} ${speedUnit}`
    currentHumidityEl.textContent = `${data.main.humidity}%`
    currentVisibilityEl.textContent = data.visibility
      ? `${(data.visibility / 1000).toFixed(1)}km`
      : "--"
    currentPressureEl.textContent = `${data.main.pressure} hPa`

    const t = data.main.temp
    const h = data.main.humidity
    const dew = Math.round(t - (100 - h) / 5)
    currentDewEl.textContent = `${dew}${tempUnit}`
    currentUvEl.textContent = `2 UV`

    setBackground(data.weather[0].id)
  }

  const renderCurrentWeatherFromForecast = (item, tz, cityData) => {
    const tempUnit = currentUnit === "metric" ? "°C" : "°F"
    const speedUnit = currentUnit === "metric" ? "m/s" : "mph"

    currentTimeEl.textContent = formatTime(item.dt, tz)
    currentTempEl.textContent = `${Math.round(item.main.temp)}°`
    currentDescEl.textContent = item.weather[0].description
    currentFeelsLikeEl.textContent = `${Math.round(item.main.feels_like)}°`

    currentWindEl.textContent = `${item.wind.speed} ${speedUnit}`
    currentHumidityEl.textContent = `${item.main.humidity}%`
    currentVisibilityEl.textContent = item.visibility
      ? `${(item.visibility / 1000).toFixed(1)}km`
      : "--"
    currentPressureEl.textContent = `${item.main.pressure} hPa`

    const t = item.main.temp
    const h = item.main.humidity
    const dew = Math.round(t - (100 - h) / 5)
    currentDewEl.textContent = `${dew}${tempUnit}`
    currentUvEl.textContent = `-- UV`

    setBackground(item.weather[0].id)
  }

  const renderHistoricalWeather = (snap) => {
    const tempUnit = currentUnit === "metric" ? "°C" : "°F"
    const speedUnit = currentUnit === "metric" ? "m/s" : "mph"

    currentTimeEl.textContent = formatTime(snap.dt, 0)
    currentTempEl.textContent = `${Math.round(snap.temp)}°`
    currentDescEl.textContent = snap.weather[0].description
    currentFeelsLikeEl.textContent = `${Math.round(snap.feels_like)}°`

    currentWindEl.textContent = `${snap.wind_speed} ${speedUnit}`
    currentHumidityEl.textContent = `${snap.humidity}%`
    currentVisibilityEl.textContent = snap.visibility
      ? `${(snap.visibility / 1000).toFixed(1)}km`
      : "--"
    currentPressureEl.textContent = `${snap.pressure} hPa`

    const dew = Math.round(snap.dew_point)
    currentDewEl.textContent = `${dew}${tempUnit}`
    currentUvEl.textContent = `${snap.uvi ? Math.round(snap.uvi) : "--"} UV`

    setBackground(snap.weather[0].id)
  }

  const renderHourly = (items, tz) => {
    hourlyContainer.innerHTML = ""
    const list = items.slice(0, 8)
    list.forEach((item) => {
      const timeStr = formatHourOnly(item.dt, tz)
      const pop = Math.round((item.pop || 0) * 100)
      const temp = Math.round(item.main ? item.main.temp : item.temp)
      const icon = getIconSrc(item.weather[0].icon)

      hourlyContainer.innerHTML += `
        <div class="hour-item">
          <div class="hour-time">${timeStr}</div>
          <img src="${icon}" class="hour-icon" alt="icon">
          <div class="hour-precip">${pop}%</div>
          <div class="hour-temp">${temp}°</div>
        </div>
      `
    })
  }

  const renderForecast = (list, tz) => {
    renderHourly(list, tz)
    renderForecastTabs(list, tz, todayStr)
  }

  const renderForecastTabs = (list, tz, activeDateStr) => {
    dayTabsContainer.innerHTML = ""

    const days = {}
    list.forEach((item) => {
      const d = new Date((item.dt + tz) * 1000)
      const dateStr = d.toISOString().split("T")[0]
      if (!days[dateStr]) {
        days[dateStr] = { temps: [], icons: [], dt: item.dt }
      }
      days[dateStr].temps.push(item.main.temp)
      days[dateStr].icons.push(item.weather[0].icon)
    })

    let isFirst = true
    for (const [dateStr, data] of Object.entries(days)) {
      const maxTemp = Math.round(Math.max(...data.temps))
      const iconToUse =
        data.icons[Math.floor(data.icons.length / 2)] || data.icons[0]
      const iconSrc = getIconSrc(iconToUse)

      let displayDay = formatDayName(data.dt, tz)
      if (isFirst) displayDay = "Today"

      const isActive = dateStr === activeDateStr

      dayTabsContainer.innerHTML += `
        <button class="day-tab ${isActive ? "active" : ""}" data-date="${dateStr}">
          ${displayDay} ${maxTemp}° <img src="${iconSrc}" style="width: 25px; height: 25px; object-fit: contain;">
        </button>
      `
      isFirst = false
    }

    dayTabsContainer.querySelectorAll(".day-tab").forEach((btn) => {
      btn.addEventListener("click", () => {
        datePicker.value = btn.dataset.date
        handleDateChange()
      })
    })
  }

  const initApp = async () => {
    headerLocation.textContent = "Locating..."
    try {
      const locRes = await fetch("/api/location")
      const locData = await locRes.json()

      if (locData.lat && locData.lon) {
        fetchAllData({ lat: locData.lat, lon: locData.lon })
      } else {
        fetchAllData({ city: "London" })
      }
    } catch (e) {
      console.error("Location Error", e)
      fetchAllData({ city: "London" })
    }
  }


  unitBtns.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      unitBtns.forEach((b) => b.classList.remove("active"))
      e.target.classList.add("active")

      const selectedUnit = e.target.dataset.unit
      if (selectedUnit !== currentUnit) {
        currentUnit = selectedUnit
        handleDateChange()
      }
    })
  })

  cityInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      const val = cityInput.value.trim()
      if (val) {
        globalCitySearch = val
        datePicker.value = todayStr
        fetchAllData({ city: val })
        cityInput.value = ""
        cityInput.blur()
      }
    }
  })

  datePicker.addEventListener("change", handleDateChange)

  initApp()
})
