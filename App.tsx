import React, { Component } from "react";
import { ScrollView, Button, SafeAreaView } from "react-native";
import PayJpCardForm from "./PayJpCardForm";

export default class App extends Component<
  object,
  {
    disabled: boolean;
  }
> {
  private payJp: PayJpCardForm | null = null;

  constructor(props: object) {
    super(props);
    this.state = {
      disabled: true,
    };
  }

  onSubmit = () => {
    this.payJp!.createToken((token, error) => {
      if (error) {
        alert(error?.message);
      } else {
        alert(token?.id);
      }
    });
  };

  render() {
    return (
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView>
          <PayJpCardForm
            ref={(ref) => {
              if (ref) {
                this.payJp = ref;
              }
            }}
            publicKey="YOUR PUBLIC KEY"
            htmlUri="https://your-html-uri"
            onChange={(data) => this.setState({ disabled: !!data })}
          />
          <Button
            title="Submit"
            disabled={this.state.disabled}
            onPress={() => this.onSubmit()}
          />
        </ScrollView>
      </SafeAreaView>
    );
  }
}
