package view;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;

import javafx.fxml.FXML;
import javafx.fxml.FXMLLoader;
import javafx.scene.layout.GridPane;
import javafx.scene.layout.VBox;
import javafx.stage.Stage;
import model.Season;
import database.Database;

public class WeekToDate extends GridPane {
	
	private List<WeekToDateElement> elements;
	
	@FXML
	private VBox weeks;
	
	private Stage stage;
	
	public WeekToDate(Season season, Stage stage){
		this.stage = stage;
		FXMLLoader fxmlLoader = new FXMLLoader(getClass().getResource(
				"WeekToDate.fxml"));
		fxmlLoader.setRoot(this);
		fxmlLoader.setController(this);
		try {
			fxmlLoader.load();
		} catch (IOException e) {
			// TODO Auto-generated catch block
			e.printStackTrace();
		}

		elements = new ArrayList<WeekToDateElement>();
		for (int i = 0; i < season.getMaxWeek(); i++) {
			WeekToDateElement element = new WeekToDateElement(i+1, season.getDates().get(i).get());
			elements.add(element);
			weeks.getChildren().add(i, element);
		}		
	}

	@FXML
	protected void save(){
		Database.getInstance().updateDates(elements);
		stage.close();
	}
	
	@FXML
	protected void cancel(){
		stage.close();
	}
}
