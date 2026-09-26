/**
* Flattens and normalizes user payloads for the downstream telemetry pipe.
* UNTYPED CONSUMER: blindly assumes all values on the user object are strings.
*/
export function formatAnalyticsPayload(userObject: Record<string, any>) {
    return Object.entries(userObject).reduce((acc, [key, value]) => {
        acc[key] = value.toString().toLowerCase();
        return acc;
    }, {} as Record<string, string>);
}
export function dispatchEvent(eventName: string, user: Record<string, any>) {
    const normalizedData = formatAnalyticsPayload(user);
    console.log(`[Telemetry] Dispatching ${eventName}:`, normalizedData);
    return normalizedData;
}