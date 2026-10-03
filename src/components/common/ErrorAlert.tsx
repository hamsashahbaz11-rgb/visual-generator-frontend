export function ErrorAlert({ message }: { message?: string }) { return message ? <div className="error-alert" role="alert">{message}</div> : null }
