import type { Metadata } from "next";

import { InfoPage, infoPageMetadata } from "@/app/[locale]/(info)/info-page";
import { StoreContactCard } from "@/components/content/store-contact";
import { routes } from "@/lib/routes";
import { getStoreContact } from "@/services/catalog.reads";
import type { PageParams } from "@/types";

const KEY = "contact";

export async function generateMetadata({
  params,
}: {
  params: PageParams<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;

  return infoPageMetadata(KEY, locale, routes.info.contact);
}

/**
 * The one information page with something other than the default aside: instead
 * of a card pointing *here*, it carries the details themselves.
 *
 * `getStoreContact` returns nulls for everything the business has not
 * configured, and `StoreContactCard` renders nothing for a null rather than a
 * placeholder — so this page is honest on the day the settings are empty and
 * correct on the day they are filled in, with no code change between.
 */
export default async function ContactPage({
  params,
}: {
  params: PageParams<{ locale: string }>;
}) {
  const { locale } = await params;
  const contact = await getStoreContact();

  return (
    <InfoPage
      pageKey={KEY}
      locale={locale}
      aside={<StoreContactCard contact={contact} />}
    />
  );
}
