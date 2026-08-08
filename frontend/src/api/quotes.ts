import { apiClient } from "@/api/client";
import type { Quote } from "@/types";

export async function getRandomQuote(): Promise<Quote> {
  const { data } = await apiClient.get<Quote>("/quotes/random");
  return data;
}
