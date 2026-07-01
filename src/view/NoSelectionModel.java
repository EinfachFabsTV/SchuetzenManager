package view;

import javafx.collections.FXCollections;
import javafx.collections.ObservableList;
import javafx.scene.control.TableColumn;
import javafx.scene.control.TablePosition;
import javafx.scene.control.TableView;

public class NoSelectionModel<T> {

	public static<T> NoTableViewSelectionModel getNoTableViewSelectionModel(TableView v) {
		return new NoTableViewSelectionModel<T>(v);
	}

	static class NoTableViewSelectionModel<T> extends
			TableView.TableViewSelectionModel<T> {

		public NoTableViewSelectionModel(TableView<T> tableView) {
			super(tableView);
			super.setSelectedIndex(-1);
			super.setSelectedItem(null);
		}

		@Override
		public ObservableList<Integer> getSelectedIndices() {
			return FXCollections.<Integer> emptyObservableList();
		}

		@Override
		public ObservableList<T> getSelectedItems() {
			return FXCollections.<T> emptyObservableList();
		}

		@Override
		public void selectAll() {
		}

		@Override
		public void selectFirst() {
		}

		@Override
		public void selectIndices(int index, int... indicies) {
		}

		@Override
		public void selectLast() {
		}

		@Override
		public void clearAndSelect(int index) {
		}

		@Override
		public void clearSelection() {
		}

		@Override
		public void clearSelection(int index) {
		}

		@Override
		public boolean isEmpty() {
			return true;
		}

		@Override
		public boolean isSelected(int index) {
			return false;
		}

		@Override
		public void select(int index) {
		}

		@Override
		public void select(T item) {
		}

		@Override
		public void selectNext() {
		}

		@Override
		public void selectPrevious() {
		}

		@Override
		public ObservableList<TablePosition> getSelectedCells() {
			// TODO Auto-generated method stub
			return FXCollections.emptyObservableList();
		}

		@Override
		public boolean isSelected(int row, TableColumn<T, ?> column) {
			// TODO Auto-generated method stub
			return false;
		}

		@Override
		public void select(int row, TableColumn<T, ?> column) {
			// TODO Auto-generated method stub

		}

		@Override
		public void clearAndSelect(int row, TableColumn<T, ?> column) {
			// TODO Auto-generated method stub

		}

		@Override
		public void clearSelection(int row, TableColumn<T, ?> column) {
			// TODO Auto-generated method stub

		}

		@Override
		public void selectLeftCell() {
			// TODO Auto-generated method stub

		}

		@Override
		public void selectRightCell() {
			// TODO Auto-generated method stub

		}

		@Override
		public void selectAboveCell() {
			// TODO Auto-generated method stub

		}

		@Override
		public void selectBelowCell() {
			// TODO Auto-generated method stub

		}

	}
}
