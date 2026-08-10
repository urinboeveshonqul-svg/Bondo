import type { Metadata } from "next";

import { InfoPage, infoPageMetadata } from "@/app/[locale]/(info)/info-page";
import { routes } from "@/lib/routes";
import type { PageParams } from "@/types";

const KEY = "warranty";

export async function generateMetadata({
  params,
}: {
  params: PageParams<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;

  return infoPageMetadata(KEY, locale, routes.info.warranty);
}

export default async function Page({
  params,
}: {
  params: PageParams<{ locale: string }>;
}) {
  const { locale } = await params;

  return <InfoPage pageKey={KEY} locale={locale} />;
}
