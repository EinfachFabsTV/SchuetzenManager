package view;

import java.io.IOException;
import java.net.URL;
import java.time.format.DateTimeFormatter;
import java.util.Collections;
import java.util.List;

import javafx.collections.FXCollections;
import javafx.collections.ObservableList;
import javafx.event.EventHandler;
import javafx.fxml.FXML;
import javafx.fxml.FXMLLoader;
import javafx.scene.Scene;
import javafx.scene.control.Label;
import javafx.scene.control.TableView;
import javafx.scene.input.MouseEvent;
import javafx.scene.layout.GridPane;
import javafx.stage.Modality;
import javafx.stage.Stage;
import model.Match;
import model.Season;
import model.TableRow;

public class MatchWeek extends GridPane {

	private static final URL URI = MatchWeek.class.getResource(
				"MatchWeek.fxml");

	@FXML
	private TableView<Match> matchTable;

	@FXML
	private TableView<TableRow> table;

	@FXML
	private Label tableuntil, date;

	DateTimeFormatter formatter = DateTimeFormatter.ofPattern("dd.MM.yyyy"); 

	public MatchWeek(Season season, int week, List<Match> matches, ObservableList<TableRow> tableData) {
		FXMLLoader fxmlLoader = new FXMLLoader(URI);
		fxmlLoader.setRoot(this);
		fxmlLoader.setController(this);
		try {
			fxmlLoader.load();
		} catch (IOException e) {
			// TODO Auto-generated catch block
			e.printStackTrace();
		}
		
		String start = matches.get(0).getDate();

		if(start != null && start.length() > 0){
			date.setText("Start: " + start);
			
		} else {
			date.setText("");
		}
		

		tableuntil.setText("Tabelle nach Wettkampfwoche " + week);
		table.setSelectionModel(NoSelectionModel.<TableRow>getNoTableViewSelectionModel(table));
		
		matchTable.setItems(FXCollections.observableArrayList(matches));
		
		table.setItems(tableData);
		Collections.sort(table.getItems());
		matchTable.setOnMouseClicked(new EventHandler<MouseEvent>() {
			@Override
			public void handle(MouseEvent t) {
				if (t.getClickCount() == 2) {
					Match m = matchTable.getSelectionModel().getSelectedItem();
					final Stage dialog = new Stage();
					dialog.initModality(Modality.APPLICATION_MODAL);
					dialog.setTitle("Wettkampf: " + m.getHometeam() + " gegen "
							+ m.getGuestteam());
					Scene dialogScene = new Scene(new MatchResult(m, dialog));
					dialog.setScene(dialogScene);
					dialog.show();

				}
			}
		});
	}
	
	public void refreshSorting(){
		Collections.sort(table.getItems());
		matchTable.getColumns().get(0).setVisible(false);
		matchTable.getColumns().get(0).setVisible(true);
		table.getColumns().get(0).setVisible(false);
		table.getColumns().get(0).setVisible(true);
		
	}

}
