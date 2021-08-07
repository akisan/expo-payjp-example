import React from "react";
import { ActivityIndicator, View } from "react-native";
import { WebView, WebViewMessageEvent } from "react-native-webview";

const PAY_JP_JS_URL = "https://js.pay.jp/v2/pay.js";
let payJpJs: string | null = null;

export type ChangeEvent = {
  empty: boolean;
  complete: boolean;
  invalid: boolean;
};

export type Error = {
  code: string;
  message: string;
};

export type Card = {
  address_city: string;
  address_line1: string;
  address_line2: string;
  address_state: string;
  address_zip: string;
  address_zip_check: "unchecked";
  brand:
    | "Visa"
    | "MasterCard"
    | "JCB"
    | "American Express"
    | "Diners Club"
    | "Discover";
  country: string;
  created: number;
  customer: null;
  cvc_check: "passed" | "in_review" | "declined";
  exp_month: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;
  exp_year: number;
  fingerprint: string;
  id: string;
  livemode: false;
  metadata: object;
  last4: string;
  name: string;
  object: "card";
};

export type Token = {
  card: Card;
  created: number;
  id: string;
  livemode: boolean;
  object: "token";
  used: boolean;
};

export type PayJpBridgeProps = {
  /**
   * payjp.js を埋め込んで実行するための https でホスティングされた HTML の URI。
   *
   * @remarks
   * payjp.js が iframe を使って実装されているので HTML 文字列を直接指定する方法ではだめ。
   * https でホスティングされた次のような HTML を WebView の uri に指定する必要がある。
   * <!DOCTYPE html>
   * <html>
   * <head></head>
   * <body></body>
   * </html>
   */
  htmlUri: string;

  /**
   * PAY.JP の公開鍵。
   */
  publicKey: string;

  /**
   * フォームの値が変更された時のコールバック関数。
   */
  onChange?: (data: Error) => void;
};

type State = {
  loaded: boolean;
};

export default class PayJpCardForm extends React.Component<
  PayJpBridgeProps,
  State
> {
  private webview: WebView | null = null;
  private callbacks: {
    [key: string]: (...params: any[]) => void;
  } = {};
  private eventHandlers: {
    [key: string]: (data: any) => void;
  };

  constructor(props: PayJpBridgeProps) {
    super(props);
    this.state = {
      loaded: false,
    };
    this.eventHandlers = {
      TOKEN: this.onToken,
      CHANGE: this.onChange,
    };
  }

  /**
   * WebView からのデータを処理します。
   */
  private onMessage = (event: WebViewMessageEvent) => {
    const { data, type } = JSON.parse(event.nativeEvent.data);
    this.eventHandlers[type] && this.eventHandlers[type](data);
  };

  /**
   * トークン作成時
   */
  private onToken = (data: {
    callbackKey: string;
    error?: string;
    token?: string;
  }) => {
    const error = data.error && JSON.parse(data.error);
    const token = data.token && JSON.parse(data.token);
    const callback = this.callbacks[data.callbackKey];
    callback && callback(token, error);
  };

  /**
   * 値変更時
   */
  private onChange = (data: Error) => {
    const { onChange } = this.props;
    onChange && onChange(data);
  };

  createToken = (callback: (token: Token, error: Error) => void): void => {
    if (this.webview) {
      const callbackKey = (+new Date()).toString();
      this.callbacks[callbackKey] = callback;
      this.webview.injectJavaScript(`createToken(${callbackKey});`);
    }
  };

  private onLoadAsync = async () => {
    const { publicKey } = this.props;
    const payJpJs = await this.getPayJpJsAsync();
    this.webview!.injectJavaScript(payJpJs);
    this.webview!.injectJavaScript(`
      const styleElm = document.createElement('style');
      styleElm.innerHTML = \`
        #number-form, #expiry-form, #cvc-form {
          margin-bottom: 1em;
        }
      \`;
      document.head.appendChild(styleElm);

      const numberForm = appendChildDiv('number-form');
      const expiryForm = appendChildDiv('expiry-form');
      const cvcForm = appendChildDiv('cvc-form');

      const payjp = Payjp('${publicKey}');
      const elements = payjp.elements();
      const style = {
        base: {
          fontSize: '17px'
        }
      };
      const numberElement = elements.create('cardNumber', { style });
      const expiryElement = elements.create('cardExpiry', { style });
      const cvcElement = elements.create('cardCvc', { style });
      numberElement.mount('#number-form');
      expiryElement.mount('#expiry-form');
      cvcElement.mount('#cvc-form');
      [numberElement, expiryElement, cvcElement].forEach(elm => {
        elm.on('change', (e) => postMessage('CHANGE', e.error));
      });

      function appendChildDiv(id)  {
        const div = document.createElement('div');
        div.setAttribute('id', id);
        document.body.appendChild(div);
        return div;
      }
      
      function postMessage(type, data) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type, data }));
      }

      function createToken(callbackKey) {
        payjp.createToken(numberElement).then((r) => {
          if (r.error) {
            postMessage('TOKEN', {
              callbackKey: callbackKey,
              error: JSON.stringify(r.error)
            });
          } else {
            postMessage('TOKEN', {
              callbackKey: callbackKey,
              token: JSON.stringify(r)
            });
          }
        })
      }
    `);
    this.setState({ loaded: true });
  };

  /**
   * payjp.js を読み込む
   */
  private getPayJpJsAsync = async () => {
    if (payJpJs) {
      return payJpJs;
    }

    return await (await fetch(PAY_JP_JS_URL)).text();
  };

  render() {
    const { htmlUri } = this.props;
    const { loaded } = this.state;

    return (
      <View>
        <WebView
          ref={(ref) => {
            if (ref) {
              this.webview = ref;
            }
          }}
          style={{ height: 110 }}
          javaScriptEnabled={true}
          scrollEnabled={false}
          bounces={false}
          source={{ uri: htmlUri }}
          onLoad={this.onLoadAsync}
          onMessage={this.onMessage}
        />
        {!loaded && (
          <ActivityIndicator
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              left: 0,
              right: 0,
            }}
          />
        )}
      </View>
    );
  }
}
