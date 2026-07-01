package view;

import java.io.IOException;

import javafx.collections.FXCollections;
import javafx.collections.ObservableList;
import javafx.fxml.FXML;
import javafx.fxml.FXMLLoader;
import javafx.scene.control.Label;
import javafx.scene.control.TableView;
import javafx.scene.layout.GridPane;
import model.Match;
import model.Shoot;

public class Conflict extends GridPane {

	@FXML
	private Label matchLbl;

	@FXML
	private TableView<Shoot> localShootsTable, remoteShootsTable, localAddShootsTable, remoteAddShootsTable;


	public Conflict(Match match, ObservableList<Shoot> remoteShoots, ObservableList<Shoot> localShoots, ObservableList<Shoot> remoteAddShoots, ObservableList<Shoot> localAddShoots, String team) {
		try {
			FXMLLoader fxmlLoader = new FXMLLoader(
					CreateSeason.class.getResource("Conflict.fxml"));
			fxmlLoader.setRoot(this);
			fxmlLoader.setController(this);
			fxmlLoader.load();
		} catch (IOException e) {
			// TODO Auto-generated catch block
			e.printStackTrace();
		}
		this.remoteShootsTable.setItems(removeEmptyRows(remoteShoots));
		this.localShootsTable.setItems(removeEmptyRows(localShoots));
		this.remoteAddShootsTable.setItems(removeEmptyRows(remoteAddShoots));
		this.localAddShootsTable.setItems(removeEmptyRows(localAddShoots));
		this.matchLbl.setText("Wettkampfwoche " + match.getWeek() + ": " + team );
	}
	
	private ObservableList<Shoot> removeEmptyRows(ObservableList<Shoot> list){
		ObservableList<Shoot> filteredList = FXCollections.observableArrayList();
		for (Shoot shoot : list) {
			if(shoot.getFirstname().trim().length() > 0){
				filteredList.add(shoot);
			}
		}
		return filteredList;
	}
}
