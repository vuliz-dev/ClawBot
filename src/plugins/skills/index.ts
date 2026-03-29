import { getWeather } from "./weather.js";
import { getDatetime } from "./datetime.js";
import { calculate } from "./calc.js";

export type SkillResult = { output: string; skillName: string };

export async function runSkill(input: string): Promise<SkillResult | null> {
  const parts = input.trim().split(/\s+/);
  const skillName = parts[0]?.toLowerCase() ?? "";
  const args = parts.slice(1).join(" ");

  switch (skillName) {
    case "weather":
    case "thời_tiết":
    case "thoitiet": {
      const location = args || "Ho Chi Minh City";
      const output = await getWeather(location);
      return { skillName: "weather", output };
    }

    case "time":
    case "datetime":
    case "giờ":
    case "gio": {
      const output = getDatetime(args || undefined);
      return { skillName: "datetime", output };
    }

    case "calc":
    case "calculate":
    case "tính":
    case "tinh": {
      if (!args) return { skillName: "calc", output: "Usage: /skill calc <expression>" };
      const output = calculate(args);
      return { skillName: "calc", output };
    }

    default:
      return null;
  }
}

export const SKILL_LIST = `*Skills có sẵn:*
\`weather <location>\` — Thời tiết
\`time\` — Ngày giờ hiện tại
\`calc <expr>\` — Tính toán (vd: calc 2+2*3)`;
