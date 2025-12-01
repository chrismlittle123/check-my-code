/**
 * Main Application Component
 * @module App
 */

/**
 * Props for the App component
 */
interface AppProps {
  /** Application title */
  title: string;
}

/**
 * Main application component
 * @param props - Component props
 * @returns The rendered application
 */
export function App(props: AppProps): JSX.Element {
  return (
    <div className="app">
      <h1>{props.title}</h1>
      <main>
        <p>Welcome to the application</p>
      </main>
    </div>
  );
}

/**
 * Default export for the App component
 */
export default App;
