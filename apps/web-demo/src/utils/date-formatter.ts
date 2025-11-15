/**
 * Date formatting utilities
 */

/**
 * Format ISO timestamp to human-readable format with timezone
 *
 * @param isoString - ISO 8601 timestamp string
 * @returns Formatted date string with timezone (e.g., "Nov 15, 2025, 10:30 AM PST")
 */
export function formatTimestamp(isoString: string): string {
  try {
    const date = new Date(isoString);

    // Check if date is valid
    if (isNaN(date.getTime())) {
      return "Invalid date";
    }

    // Format with browser's locale
    const formatted = date.toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });

    // Get timezone abbreviation
    const timezone = getTimezoneAbbreviation(date);

    return `${formatted} ${timezone}`;
  } catch (error) {
    console.error("Error formatting timestamp:", error);
    return "Invalid date";
  }
}

/**
 * Get timezone abbreviation for a date
 *
 * @param date - Date object
 * @returns Timezone abbreviation (e.g., "PST", "EST", "UTC")
 */
function getTimezoneAbbreviation(date: Date): string {
  const formatted = date.toLocaleString("en-US", {
    timeZoneName: "short",
  });

  // Extract timezone abbreviation from the formatted string
  // Format is typically: "MM/DD/YYYY, HH:MM:SS AM/PM TIMEZONE"
  const parts = formatted.split(" ");
  const timezone = parts[parts.length - 1];

  return timezone;
}
