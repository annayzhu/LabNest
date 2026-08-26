export type PageSearchParams = Promise<Record<string, string | string[] | undefined>>;

export function firstSearchParam(
  params: Record<string, string | string[] | undefined> | undefined,
  key: string,
) {
  const value = params?.[key];

  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

export function firstOptionSearchParam<const T extends string>(
  params: Record<string, string | string[] | undefined> | undefined,
  key: string,
  options: readonly { value: T }[],
) {
  const value = firstSearchParam(params, key);
  return value !== undefined && options.some((option) => option.value === value) ? value as T : undefined;
}

export function filterHref(pathname: string, filters: Record<string, string | number | undefined>) {
  const searchParams = new URLSearchParams();

  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== "") {
      searchParams.set(key, String(value));
    }
  });

  const queryString = searchParams.toString();
  return queryString ? `${pathname}?${queryString}` : pathname;
}
