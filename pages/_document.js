import Document, { Html, Head, Main, NextScript } from 'next/document';

export default class AppDocument extends Document {
  static async getInitialProps(ctx) {
    const initialProps = await Document.getInitialProps(ctx);
    return {
      ...initialProps,
      nonce: ctx.req?.headers['x-csp-nonce'] || ''
    };
  }

  render() {
    const nonce = this.props.nonce || '';
    return (
      <Html lang="en">
        <Head nonce={nonce} />
        <body>
          <Main />
          <NextScript nonce={nonce} />
        </body>
      </Html>
    );
  }
}
