/**
 * Error display module for showing user-friendly error messages
 */

let errorElement: HTMLElement | null = null;
let retryButton: HTMLButtonElement | null = null;
let retryCallback: (() => void) | null = null;
let retryCount = 0;
const MAX_RETRIES = 3;

/**
 * Show error message to user with optional retry button
 *
 * @param message - User-friendly error message
 * @param allowRetry - Whether to show retry button
 * @param onRetry - Callback function to execute on retry
 */
export function showError(
  message: string,
  allowRetry = false,
  onRetry?: () => void
): void {
  // Hide any existing error first
  hideError();

  // Create error banner
  errorElement = document.createElement("div");
  errorElement.className = "error-banner";
  errorElement.setAttribute("role", "alert");
  errorElement.setAttribute("aria-live", "assertive");

  // Create message text
  const messageElement = document.createElement("p");
  messageElement.className = "error-message";
  messageElement.textContent = message;
  errorElement.appendChild(messageElement);

  // Add retry button if allowed and callback provided
  if (allowRetry && onRetry && retryCount < MAX_RETRIES) {
    retryCallback = onRetry;

    const buttonContainer = document.createElement("div");
    buttonContainer.className = "error-actions";

    retryButton = document.createElement("button");
    retryButton.className = "error-retry-button";
    retryButton.textContent = `Retry (${retryCount + 1}/${MAX_RETRIES})`;
    retryButton.addEventListener("click", handleRetry);

    buttonContainer.appendChild(retryButton);
    errorElement.appendChild(buttonContainer);
  } else if (retryCount >= MAX_RETRIES) {
    // Show message that max retries reached
    const retryMessage = document.createElement("p");
    retryMessage.className = "error-retry-limit";
    retryMessage.textContent =
      "Maximum retry attempts reached. Please refresh the page.";
    errorElement.appendChild(retryMessage);
  }

  // Add close button
  const closeButton = document.createElement("button");
  closeButton.className = "error-close-button";
  closeButton.textContent = "×";
  closeButton.setAttribute("aria-label", "Close error message");
  closeButton.addEventListener("click", hideError);
  errorElement.appendChild(closeButton);

  // Add to page
  document.body.appendChild(errorElement);

  // Trigger animation
  requestAnimationFrame(() => {
    errorElement?.classList.add("error-banner-visible");
  });
}

/**
 * Handle retry button click
 */
function handleRetry(): void {
  retryCount++;

  // Disable button to prevent multiple clicks
  if (retryButton) {
    retryButton.disabled = true;
    retryButton.textContent = "Retrying...";
  }

  // Execute retry callback
  if (retryCallback) {
    retryCallback();
  }

  // Hide error (will be shown again if retry fails)
  hideError();
}

/**
 * Hide error message
 */
export function hideError(): void {
  if (errorElement) {
    errorElement.classList.remove("error-banner-visible");

    // Wait for animation to complete before removing
    setTimeout(() => {
      if (errorElement && errorElement.parentNode) {
        errorElement.parentNode.removeChild(errorElement);
      }
      errorElement = null;
      retryButton = null;
    }, 300); // Match CSS transition duration
  }
}

/**
 * Reset retry counter (call when operation succeeds)
 */
export function resetRetryCount(): void {
  retryCount = 0;
}

/**
 * Get current retry count
 */
export function getRetryCount(): number {
  return retryCount;
}
