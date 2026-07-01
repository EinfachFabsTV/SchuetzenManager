package custom;

import javafx.scene.control.TextField;

public class IntegerTextField extends TextField {

	@Override
	public void replaceText(int start, int end, String text) {
		if (validate(text)) {
			super.replaceText(start, end, text);
		}
	}

	@Override
	public void replaceSelection(String text) {
		if (validate(text)) {
			super.replaceSelection(text);
		}
	}

	private boolean validate(String text) {
		if ((text.matches("[0-9]") || text.isEmpty()) && getText().length() <= 3) {
			return true;
		}
		return false;
	}
}
