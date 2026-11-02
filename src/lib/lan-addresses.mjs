/** Only physical Wi-Fi/Ethernet IPv4 addresses; never advertise VPN or Docker bridges. */
export function lanAddresses(interfaces) {
  return [...new Set(Object.entries(interfaces)
    .filter(([name]) => /^(en\d|enp|ens|eno|eth\d|wl)/i.test(name))
    .flatMap(([, entries]) => (entries ?? [])
      .filter(entry => entry.family === 'IPv4' && !entry.internal && isLanIpv4(entry.address))
      .map(entry => entry.address)))];
}

export function isLanIpv4(address) {
  if (typeof address !== 'string' || !/^\d{1,3}(\.\d{1,3}){3}$/.test(address)) return false;
  const octets = address.split('.').map(Number);
  if (octets.some(value => value > 255)) return false;
  return octets[0] === 10 || (octets[0] === 192 && octets[1] === 168)
    || (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31);
}

/** Expired host snapshots must not silently produce a QR code for an old Wi-Fi. */
export function freshLanAddresses(snapshot, now = Date.now()) {
  if (!snapshot || !Number.isFinite(snapshot.updatedAt) || now - snapshot.updatedAt > 20000
    || snapshot.updatedAt > now + 5000 || !Array.isArray(snapshot.addresses)) return [];
  return [...new Set(snapshot.addresses.filter(isLanIpv4))];
}
