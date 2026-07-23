# -*- coding: utf-8 -*-
"""Read-only Open-Meteo weather forecast adapter."""
from __future__ import annotations

from typing import Any

import httpx


GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search"
FORECAST_URL = "https://api.open-meteo.com/v1/forecast"
REQUEST_TIMEOUT_SECONDS = 10.0

WEATHER_CODE_DESCRIPTIONS = {
    0: "晴朗",
    1: "大部晴朗",
    2: "局部多云",
    3: "阴天",
    45: "有雾",
    48: "雾凇",
    51: "小毛毛雨",
    53: "毛毛雨",
    55: "强毛毛雨",
    56: "轻微冻毛毛雨",
    57: "强冻毛毛雨",
    61: "小雨",
    63: "中雨",
    65: "大雨",
    66: "轻微冻雨",
    67: "强冻雨",
    71: "小雪",
    73: "中雪",
    75: "大雪",
    77: "米雪",
    80: "小阵雨",
    81: "中阵雨",
    82: "强阵雨",
    85: "小阵雪",
    86: "强阵雪",
    95: "雷暴",
    96: "雷暴伴小冰雹",
    99: "雷暴伴强冰雹",
}


class WeatherServiceError(ValueError):
    """Raised when Open-Meteo returns an unusable response."""


def _number(value: Any, *, field: str) -> float:
    if not isinstance(value, (int, float)):
        raise WeatherServiceError(f"天气服务返回的 {field} 数据无效。")
    return round(float(value), 1)


def _integer(value: Any, *, field: str) -> int:
    if not isinstance(value, (int, float)):
        raise WeatherServiceError(f"天气服务返回的 {field} 数据无效。")
    return int(round(float(value)))


def _advice(
    *,
    condition: str,
    temperature_max: float,
    precipitation_probability: int,
    wind_speed: float,
) -> str:
    suggestions: list[str] = []
    if precipitation_probability >= 60:
        suggestions.append("降雨概率较高，建议携带雨具")
    elif precipitation_probability >= 30:
        suggestions.append("可能有降雨，外出可备雨具")
    if temperature_max >= 35:
        suggestions.append("注意防暑补水")
    elif temperature_max <= 5:
        suggestions.append("天气较冷，注意保暖")
    if wind_speed >= 30:
        suggestions.append("风力较强，注意出行安全")
    if not suggestions:
        suggestions.append(f"天气以{condition}为主，适合按日常安排出行")
    return "；".join(suggestions) + "。"


def _friendly_failure(city: str, message: str) -> dict[str, Any]:
    return {
        "ok": False,
        "city": city,
        "error": message,
        "source": "Open-Meteo",
    }


def get_weather_forecast(
    city: str,
    days: int = 1,
    start_day: int = 0,
) -> dict[str, Any]:
    """Geocode a city and return a sanitized daily Open-Meteo forecast."""
    normalized_city = str(city or "").strip()
    if not normalized_city:
        return _friendly_failure("", "请提供要查询的城市名称。")

    normalized_days = max(1, min(int(days), 7))
    normalized_start_day = max(0, min(int(start_day), 6))
    forecast_days = min(normalized_start_day + normalized_days, 7)

    try:
        with httpx.Client(timeout=REQUEST_TIMEOUT_SECONDS) as client:
            geocoding_response = client.get(
                GEOCODING_URL,
                params={
                    "name": normalized_city,
                    "count": 1,
                    "language": "zh",
                    "format": "json",
                },
            )
            geocoding_response.raise_for_status()
            geocoding_payload = geocoding_response.json()
            locations = geocoding_payload.get("results")
            if not isinstance(locations, list) or not locations:
                return _friendly_failure(
                    normalized_city,
                    f"没有找到城市“{normalized_city}”，请检查名称后重试。",
                )

            location = locations[0]
            if not isinstance(location, dict):
                raise WeatherServiceError("地理编码服务返回了无效的城市数据。")
            latitude = location.get("latitude")
            longitude = location.get("longitude")
            if not isinstance(latitude, (int, float)) or not isinstance(
                longitude,
                (int, float),
            ):
                raise WeatherServiceError("地理编码服务未返回有效经纬度。")

            forecast_response = client.get(
                FORECAST_URL,
                params={
                    "latitude": latitude,
                    "longitude": longitude,
                    "daily": (
                        "weather_code,temperature_2m_max,temperature_2m_min,"
                        "precipitation_probability_max,wind_speed_10m_max"
                    ),
                    "timezone": "auto",
                    "forecast_days": forecast_days,
                },
            )
            forecast_response.raise_for_status()
            forecast_payload = forecast_response.json()
    except (httpx.HTTPError, ValueError) as exc:
        return _friendly_failure(
            normalized_city,
            "天气服务暂时不可用，请稍后重试。",
        )

    try:
        daily = forecast_payload.get("daily")
        if not isinstance(daily, dict):
            raise WeatherServiceError("天气服务未返回每日预报。")
        fields = {
            "date": daily.get("time"),
            "weather_code": daily.get("weather_code"),
            "temperature_max": daily.get("temperature_2m_max"),
            "temperature_min": daily.get("temperature_2m_min"),
            "precipitation_probability": daily.get(
                "precipitation_probability_max",
            ),
            "wind_speed": daily.get("wind_speed_10m_max"),
        }
        if any(not isinstance(values, list) for values in fields.values()):
            raise WeatherServiceError("天气服务返回的每日预报格式无效。")
        lengths = {len(values) for values in fields.values()}
        if len(lengths) != 1 or not lengths:
            raise WeatherServiceError("天气服务返回的每日预报数据不完整。")

        forecasts: list[dict[str, Any]] = []
        end_day = normalized_start_day + normalized_days
        for index in range(normalized_start_day, end_day):
            weather_code = _integer(
                fields["weather_code"][index],
                field="天气状况",
            )
            temperature_max = _number(
                fields["temperature_max"][index],
                field="最高温度",
            )
            temperature_min = _number(
                fields["temperature_min"][index],
                field="最低温度",
            )
            precipitation_probability = _integer(
                fields["precipitation_probability"][index],
                field="降雨概率",
            )
            wind_speed = _number(
                fields["wind_speed"][index],
                field="风速",
            )
            condition = WEATHER_CODE_DESCRIPTIONS.get(
                weather_code,
                "未知天气状况",
            )
            forecasts.append(
                {
                    "date": str(fields["date"][index]),
                    "condition": condition,
                    "temperature_max_c": temperature_max,
                    "temperature_min_c": temperature_min,
                    "precipitation_probability_percent": (
                        precipitation_probability
                    ),
                    "wind_speed_max_kmh": wind_speed,
                    "advice": _advice(
                        condition=condition,
                        temperature_max=temperature_max,
                        precipitation_probability=precipitation_probability,
                        wind_speed=wind_speed,
                    ),
                },
            )
    except (IndexError, WeatherServiceError):
        return _friendly_failure(
            normalized_city,
            "天气服务返回的数据不完整，请稍后重试。",
        )

    return {
        "ok": True,
        "city": str(location.get("name") or normalized_city),
        "country": str(location.get("country") or ""),
        "timezone": str(forecast_payload.get("timezone") or ""),
        "source": "Open-Meteo",
        "forecasts": forecasts,
    }
