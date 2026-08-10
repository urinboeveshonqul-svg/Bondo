import { useTranslations } from "next-intl";
import { Clock, Mail, MapPin, Phone, Send } from "lucide-react";

/**
 * The shop's own contact details, as configured.
 *
 * ## Nothing here is invented
 *
 * Every value comes from `public.settings` — `store.phone`, `store.telegram`,
 * `store.support_email`, `store.address`, `store.hours` — and every one of them
 * is currently **null**, because the business has not supplied them. A row that
 * is null renders **nothing at all**: not a placeholder, not a dash, not an
 * example number.
 *
 * That is the whole point of the component. A contact page with a plausible
 * fake phone number on it is worse than one that admits it has no phone number,
 * because a customer will ring the fake one.
 *
 * When every field is empty the card says so in the visitor's language rather
 * than rendering an empty box. The pages that point here — returns, warranty —
 * still make sense: they tell the reader to get in touch, and this is where the
 * details appear the moment somebody sets them in `/admin/settings`.
 *
 * ## Why the links are what they are
 *
 * A phone number is a `tel:` link, because on the device most of this shop's
 * visitors use, a phone number that cannot be tapped is a phone number that has
 * to be copied by hand. Telegram is an `https://t.me/` link built from a
 * username, so the stored value stays a username and the URL shape lives here.
 * The address and the hours are text: an address is not a link without a map
 * provider, and inventing which one is exactly the class of decision this
 * component exists to avoid.
 */
export type StoreContact = {
  phone: string | null;
  telegram: string | null;
  email: string | null;
  address: string | null;
  hours: string | null;
};

export function StoreContactCard({ contact }: { contact: StoreContact }) {
  const t = useTranslations("info.contact");

  const hasAny = Object.values(contact).some(Boolean);

  return (
    <div className="rounded-xl border bg-muted/40 p-5">
      <h2 className="text-sm font-semibold tracking-tight">{t("title")}</h2>

      {hasAny ? (
        <dl className="mt-3 space-y-3">
          {contact.phone ? (
            <Detail icon={<Phone />} label={t("phone")}>
              <a
                href={`tel:${contact.phone.replace(/\s+/g, "")}`}
                className="rounded-sm hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                {contact.phone}
              </a>
            </Detail>
          ) : null}

          {contact.telegram ? (
            <Detail icon={<Send />} label={t("telegram")}>
              <a
                href={`https://t.me/${contact.telegram}`}
                className="rounded-sm hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                @{contact.telegram}
              </a>
            </Detail>
          ) : null}

          {contact.email ? (
            <Detail icon={<Mail />} label={t("email")}>
              <a
                href={`mailto:${contact.email}`}
                className="rounded-sm break-all hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                {contact.email}
              </a>
            </Detail>
          ) : null}

          {contact.address ? (
            <Detail icon={<MapPin />} label={t("address")}>
              {contact.address}
            </Detail>
          ) : null}

          {contact.hours ? (
            <Detail icon={<Clock />} label={t("hours")}>
              {contact.hours}
            </Detail>
          ) : null}
        </dl>
      ) : (
        <p className="mt-1.5 text-sm text-pretty text-muted-foreground">
          {t("unconfigured")}
        </p>
      )}
    </div>
  );
}

function Detail({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-2.5">
      <span
        aria-hidden="true"
        className="mt-0.5 shrink-0 text-muted-foreground [&>svg]:size-4"
      >
        {icon}
      </span>
      <div className="min-w-0">
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd className="text-sm">{children}</dd>
      </div>
    </div>
  );
}
