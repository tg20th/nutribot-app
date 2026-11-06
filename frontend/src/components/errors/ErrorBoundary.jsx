import { Component, Fragment } from 'react';
import ErrorPage from './ErrorPage';

export default class ErrorBoundary extends Component {
  state = { error: null, retryKey: 0 };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, errorInfo) {
    if (import.meta.env.DEV) console.error('NutriBot page rendering error:', error, errorInfo);
  }

  retry = () => this.setState((current) => ({ error: null, retryKey: current.retryKey + 1 }));

  render() {
    if (this.state.error) return <ErrorPage status={500} onRetry={this.retry}/>;
    return <Fragment key={this.state.retryKey}>{this.props.children}</Fragment>;
  }
}
